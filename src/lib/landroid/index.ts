import awsIot from 'aws-iot-device-sdk';
import { HttpsCookieAgent } from 'http-cookie-agent/http';
import { CookieJar } from 'tough-cookie';

import { HttpMqttBridge } from '~/lib/http-mqtt-bridge';
import type { MqttBridgeClient } from '~/modules/mqtt/mqtt.service';
import type { LandroidConfig } from '~/types/config/landroid';

import { authenticationFile, loadAuthentication, persistAuthentication } from './authentication';
import {
  CLOUDS,
  DEFAULT_MQTT_ENDPOINT,
  type CloudClient,
  type CloudMower,
  type CloudToken,
  type CloudUser,
} from './cloud';
import { createMowerCommand, parseMowerCommand } from './command';
import { mapConfigurationToMqtt } from './configuration';
import { authenticationHeaders, authorizedHeaders, cloudHeaders, endpointRegion } from './headers';

/** Bridges one Landroid cloud account and its configured mowers to MQTT. */
export class Landroid extends HttpMqttBridge<LandroidConfig> {
  private readonly cookieJar = new CookieJar();
  private readonly httpsAgent = new HttpsCookieAgent({
    cookies: { jar: this.cookieJar },
    keepAlive: false,
  });
  private readonly mowerOnline = new Map<string, boolean>();
  private readonly publishedStatuses = new Set<string>();
  private cloudClient?: CloudClient;
  private cloudMowers = new Map<string, CloudMower>();
  private destroyed = false;
  private refreshTimer?: NodeJS.Timeout;
  private token?: CloudToken;
  private user?: CloudUser;

  /** Creates a bridge for one configured cloud account. */
  constructor(cfg: LandroidConfig, mqtt: MqttBridgeClient) {
    super(cfg, mqtt, `LANDROID@${cfg.cloud.type}`, '');
    this.api.defaults.httpsAgent = this.httpsAgent;
    this.api.defaults.withCredentials = true;
  }

  //#region lifecycle
  /** Publishes the initial offline state, subscribes to commands, and starts the cloud session. */
  public setup() {
    this.mqtt.publish(`${this.cfg.topic}/connected`, false);
    for (const mower of this.enabledMowers) {
      this.setMowerOnline(mower.serial, false);
      this.subscribeCommands(mower);
    }

    void this.start();
    this.poll('mowers', this.cfg.updateInterval, () => this.updateMowers());
  }

  /** Ends every active connection and leaves retained state unavailable. */
  public override destroy() {
    if (this.destroyed) return;

    this.destroyed = true;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.cloudClient?.end(true);
    this.cloudClient = undefined;
    this.httpsAgent.destroy();

    for (const mower of this.enabledMowers) {
      this.setMowerOnline(mower.serial, false);
    }
    this.mqtt.publish(`${this.cfg.topic}/connected`, false);

    super.destroy();
  }
  //#endregion

  //#region cloud setup
  /** Resolves the selected vendor cloud and an optional login URL override. */
  private get cloud() {
    const cloud = CLOUDS[this.cfg.cloud.type];
    return { ...cloud, loginUrl: this.cfg.cloud.loginUrl ?? cloud.loginUrl };
  }

  /** Returns only mowers intentionally exposed through MQTT. */
  private get enabledMowers() {
    return this.cfg.mower.filter((mower) => mower.enabled);
  }

  /** Restores or creates credentials, discovers mowers, then opens cloud MQTT. */
  private async start() {
    const restored = await this.loadAuthentication();
    if (this.destroyed) return;
    if (!restored && !(await this.login())) return;
    if (restored) await this.refreshToken();
    if (!this.token) return;
    if (this.destroyed) return;

    await this.getMowers();
    if (this.destroyed || this.cloudMowers.size === 0) return;
    this.mqtt.publish(`${this.cfg.topic}/connected`, true);

    await this.updateMowers();
    if (this.destroyed || !this.setUserFromMowers()) return;

    this.connectCloudMqtt();
    this.scheduleTokenRefresh();
  }

  /** Signs in with the configured cloud account and stores its refresh token. */
  private async login() {
    const controller = this.startRequest('login');

    try {
      const response = await this.api.post<CloudToken>(
        `${this.cloud.loginUrl.replace(/\/+$/, '')}/oauth/token`,
        {
          client_id: this.cloud.clientId,
          grant_type: 'password',
          password: this.cfg.cloud.password,
          scope: '*',
          username: this.cfg.cloud.email,
        },
        { headers: authenticationHeaders(), signal: controller.signal },
      );
      if (controller.signal.aborted || this.destroyed) return false;

      this.token = response.data;
      await this.persistAuthentication();
      this.logger.log(`Connected to ${this.cfg.cloud.type} cloud.`);
      return true;
    } catch (error) {
      if (!controller.signal.aborted) {
        this.logError('Landroid cloud login failed.', error);
      }
      return false;
    } finally {
      this.finishRequest('login', controller);
    }
  }

  /** Fetches cloud mowers and keeps only explicitly configured serial numbers. */
  private async getMowers() {
    const controller = this.startRequest('mowers');

    try {
      const response = await this.api.get<CloudMower[]>(
        `https://${this.cloud.apiHost}/api/v2/product-items?status=1&gps_status=1`,
        { headers: authorizedHeaders(this.token), signal: controller.signal },
      );
      if (controller.signal.aborted || this.destroyed) return;

      const mowersBySerial = new Map(response.data.map((mower) => [mower.serial_number, mower]));
      for (const mower of this.enabledMowers) {
        const cloudMower = mowersBySerial.get(mower.serial);
        if (!cloudMower) {
          this.logger.warn(`Configured mower ${mower.serial} was not found in the cloud account.`);
          continue;
        }

        this.cloudMowers.set(mower.serial, cloudMower);
      }
    } catch (error) {
      this.handleCloudRequestError('Failed to get Landroid mower list.', controller, error);
    } finally {
      this.finishRequest('mowers', controller);
    }
  }

  /** Gets the cloud user ID from a mower because the cloud no longer supports `GET /users/me`. */
  private setUserFromMowers() {
    const mower = this.cloudMowers.values().next().value as CloudMower | undefined;
    if (!mower?.user_id) {
      this.logger.warn('Could not determine the Landroid cloud user from the configured mowers.');
      return false;
    }

    this.user = { id: mower.user_id };
    return true;
  }

  /** Refreshes sufficiently before expiry, while waiting at least one minute between attempts. */
  private scheduleTokenRefresh() {
    if (!this.token || this.destroyed) return;

    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const timeout = Math.max((this.token.expires_in - 100) * 1_000, 60_000);
    this.refreshTimer = setTimeout(() => void this.refreshToken(), timeout);
  }

  /** Refreshes the bearer token and updates the already-open cloud MQTT client. */
  private async refreshToken() {
    if (!this.token || this.destroyed) return;

    const controller = this.startRequest('refresh-token');
    try {
      const response = await this.api.post<CloudToken>(
        `${this.cloud.loginUrl.replace(/\/+$/, '')}/oauth/token`,
        {
          client_id: this.cloud.clientId,
          grant_type: 'refresh_token',
          refresh_token: this.token.refresh_token,
          scope:
            'user:profile mower:firmware mower:view mower:pair user:manage mower:update mower:activity_log user:certificate data:products mower:unpair mower:warranty mobile:notifications mower:lawn',
        },
        { headers: authenticationHeaders(), signal: controller.signal },
      );
      if (controller.signal.aborted || this.destroyed) return;

      this.token = response.data;
      await this.persistAuthentication();
      this.cloudClient?.updateCustomAuthHeaders?.(cloudHeaders(this.token));
      this.scheduleTokenRefresh();
    } catch (error) {
      this.handleCloudRequestError('Failed to refresh Landroid cloud token.', controller, error);
    } finally {
      this.finishRequest('refresh-token', controller);
    }
  }

  /** Restores an existing refresh token without logging credentials. */
  private async loadAuthentication() {
    try {
      this.token = await loadAuthentication(authenticationFile(this.cfg));

      return Boolean(this.token);
    } catch {
      this.logger.warn('Could not load Landroid authentication file.');

      return false;
    }
  }

  /** Persists the current refresh token with private file permissions. */
  private async persistAuthentication() {
    if (!this.token?.refresh_token) return;

    try {
      await persistAuthentication(authenticationFile(this.cfg), this.token);
    } catch {
      this.logger.warn('Could not persist Landroid authentication file.');
    }
  }
  //#endregion

  //#region state
  /** Refreshes state for every configured mower known to the cloud. */
  private async updateMowers() {
    if (!this.token || this.destroyed) return;

    for (const mower of this.enabledMowers) {
      if (!this.cloudMowers.has(mower.serial)) continue;
      await this.updateMower(mower.serial);
    }
  }

  /** Refreshes and publishes one mower's REST snapshot. */
  private async updateMower(serial: string) {
    const controller = this.startRequest(`mower:${serial}`);

    try {
      const response = await this.api.get<CloudMower>(
        `https://${this.cloud.apiHost}/api/v2/product-items/${serial}/?status=1&gps_status=1`,
        { headers: authorizedHeaders(this.token), signal: controller.signal },
      );
      if (controller.signal.aborted || this.destroyed) return;

      this.cloudMowers.set(serial, { ...this.cloudMowers.get(serial), ...response.data });
      this.setMowerOnline(serial, response.data.online === true);
      this.publishMowerData(serial, response.data.last_status?.payload ?? response.data);
    } catch (error) {
      if (!controller.signal.aborted) this.setMowerOnline(serial, false);
      this.handleCloudRequestError(`Failed to update Landroid mower ${serial}.`, controller, error);
    } finally {
      this.finishRequest(`mower:${serial}`, controller);
    }
  }

  /** Publishes the raw snapshot and its stable flattened configuration fields. */
  private publishMowerData(serial: string, data: unknown) {
    const mower = this.enabledMowers.find((candidate) => candidate.serial === serial);
    if (!mower) return;

    this.mqtt.publish(`${mower.topic}/mowerdata`, JSON.stringify(data));
    this.publishConfiguration(mower.topic, getRecord(data));
  }

  /** Publishes each known mower configuration value under its own MQTT topic. */
  private publishConfiguration(topic: string, data: unknown) {
    for (const [path, value] of mapConfigurationToMqtt(getRecord(data))) {
      this.mqtt.publish(`${topic}/configuration/${path}`, value);
    }
  }

  /** Emits an availability transition once, including the initial offline state. */
  private setMowerOnline(serial: string, online: boolean) {
    const mower = this.enabledMowers.find((candidate) => candidate.serial === serial);
    if (!mower) return;
    if (this.publishedStatuses.has(serial) && this.mowerOnline.get(serial) === online) return;

    this.mowerOnline.set(serial, online);
    this.publishedStatuses.add(serial);
    this.mqtt.publish(`${mower.topic}/status`, JSON.stringify({ online }));
  }
  //#endregion

  //#region cloud mqtt
  /** Opens one vendor MQTT client for the account and subscribes to each mower. */
  private connectCloudMqtt() {
    const firstMower = this.cloudMowers.values().next().value as CloudMower | undefined;
    if (!firstMower || !this.user || this.destroyed) return;

    const endpoint = firstMower.mqtt_endpoint ?? DEFAULT_MQTT_ENDPOINT;
    const clientId = `${this.cloud.mqttPrefix}/USER/${this.user.id}/mqtt-bridges/${firstMower.uuid ?? crypto.randomUUID()}`;
    const options = {
      baseReconnectTimeMs: 5_000,
      clientId,
      customAuthHeaders: cloudHeaders(this.token),
      host: endpoint,
      protocol: 'wss-custom-auth',
      region: endpointRegion(endpoint),
      username: 'mqtt-bridges',
    };
    this.cloudClient = new (awsIot as unknown as { device: new (options: unknown) => CloudClient }).device(options);

    this.cloudClient.on('connect', () => {
      this.logger.log(`Connected to ${this.cfg.cloud.type} cloud MQTT.`);
      for (const mower of this.cloudMowers.values()) {
        if (!mower.mqtt_topics) continue;

        this.cloudClient?.subscribe(mower.mqtt_topics.command_out, { qos: 1 });
        this.cloudClient?.publish(mower.mqtt_topics.command_in, '{}', { qos: 1 });
      }
    });
    this.cloudClient.on('message', (topic, payload) => this.handleCloudMessage(String(topic), payload as Buffer));
    this.cloudClient.on('error', (error) => this.logError('Landroid cloud MQTT failed.', error));
    this.cloudClient.on('offline', () => this.logger.warn('Landroid cloud MQTT is offline.'));
  }

  /** Forwards a cloud MQTT snapshot to the matching configured mower. */
  private handleCloudMessage(topic: string, payload: Buffer) {
    const mower = [...this.cloudMowers.values()].find((candidate) => candidate.mqtt_topics?.command_out === topic);
    if (!mower) return;

    this.setMowerOnline(mower.serial_number, true);
    const message = payload.toString();
    this.mqtt.publish(`${this.getMowerTopic(mower.serial_number)}/mowerdata`, message);

    try {
      const data = JSON.parse(message) as Record<string, unknown>;
      this.cloudMowers.set(mower.serial_number, { ...mower, last_status: { payload: data } });
      this.publishConfiguration(this.getMowerTopic(mower.serial_number), data);
    } catch {
      this.logger.warn('Received invalid JSON from Landroid cloud MQTT.');
    }
  }

  //#endregion

  //#region commands
  /** Handles one non-retained JSON command topic for a mower. */
  private subscribeCommands(mower: LandroidConfig['mower'][number]) {
    const commandTopic = `${mower.topic}/set/json`;
    this.subscribe(commandTopic, (_, payload) => {
      if (payload === '') return;

      try {
        void this.sendCommand(mower.serial, parseMowerCommand(payload));
        this.mqtt.publish(commandTopic, null);
      } catch (error) {
        this.logError(`Invalid Landroid command on ${commandTopic}.`, error);
      }
    });
  }

  /** Sends a command only while the target mower and cloud MQTT are online. */
  private async sendCommand(serial: string, command: Record<string, unknown>) {
    const mower = this.cloudMowers.get(serial);
    if (!mower?.mqtt_topics || !this.cloudClient || !this.mowerOnline.get(serial)) {
      this.logger.warn(`Ignoring command for offline Landroid mower ${serial}.`);
      this.setMowerOnline(serial, false);
      return;
    }

    const cfg = mower.last_status?.payload?.cfg;
    const language = cfg && typeof cfg === 'object' ? (cfg as Record<string, unknown>).lg : undefined;
    const envelope = createMowerCommand(serial, language, command);

    this.cloudClient.publish(mower.mqtt_topics.command_in, JSON.stringify(envelope), { qos: 1 });
  }
  //#endregion

  /** Returns the configured topic for a serial, or the serial for an unknown cloud mower. */
  private getMowerTopic(serial: string) {
    return this.enabledMowers.find((mower) => mower.serial === serial)?.topic ?? serial;
  }

  /** Suppresses expected cancellation errors during teardown. */
  private handleCloudRequestError(message: string, controller: AbortController, error: unknown) {
    if (controller.signal.aborted || this.destroyed) return;

    this.logError(message, error);
  }

  /** Logs only error messages because Axios error objects may include request credentials. */
  private logError(message: string, error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    this.logger.error(`${message} ${detail}`);
  }
}

/** Narrows an untrusted value to a non-array record. */
function getRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
