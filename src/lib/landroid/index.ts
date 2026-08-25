import awsIot from 'aws-iot-device-sdk';
import { HttpsCookieAgent } from 'http-cookie-agent/http';
import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CookieJar } from 'tough-cookie';
import { ENV } from '~/config/env';
import { HttpMqttBridge } from '~/lib/http-mqtt-bridge';
import type { MqttBridgeClient } from '~/modules/mqtt/mqtt.service';
import { LandroidConfig } from '~/types/config/landroid';
import {
  CLOUDS,
  DEFAULT_MQTT_ENDPOINT,
  type CloudAuthentication,
  type CloudClient,
  type CloudMower,
  type CloudToken,
  type CloudUser,
} from './cloud';
import { mapConfigurationToMqtt } from './configuration';

/** Bridges one Landroid cloud account and its configured mowers to MQTT.
 */
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

  /**
   * Creates the class instance.
   * @param {{ mower: { topic: string; serial: string; enabled: boolean; }[]; id: string; enabled: boolean; topic: string; cloud: { type: "worx" | "kress" | "landxcape" | "ferrex"; email: string; password: string; loginUrl?: string | undefined; }; updateInterval: number; authFile?: string | undefined; }} cfg The cfg value.
   * @param {MqttBridgeClient} mqtt The mqtt value.
   */
  constructor(cfg: LandroidConfig, mqtt: MqttBridgeClient) {
    super(cfg, mqtt, `LANDROID@${cfg.cloud.type}`, '');
    this.api.defaults.httpsAgent = this.httpsAgent;
    this.api.defaults.withCredentials = true;
  }

  //#region lifecycle
  /**
   * Executes `setup`.
   * @returns {void} Result.
   */
  public setup() {
    this.mqtt.publish(`${this.cfg.topic}/connected`, false);
    for (const mower of this.enabledMowers) {
      this.setMowerOnline(mower.serial, false);
      this.subscribeCommands(mower);
    }

    void this.start();
    this.poll('mowers', this.cfg.updateInterval, () => this.updateMowers());
  }

  /**
   * Executes `destroy`.
   * @returns {void} Result.
   */
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
  /**
   * Executes `cloud`.
   * @returns {{ loginUrl: string; apiHost: "api.watermelon.smartmower.cloud"; clientId: "10078D10-3840-474A-848A-5EED949AB0FC"; mqttPrefix: "FE"; } | { loginUrl: string; apiHost: "api.kress-robotik.com"; clientId: "931d4bc4-3192-405a-be78-98e43486dc59"; mqttPrefix: "KR"; } | { ...; } | { ...; }} Result.
   */
  private get cloud() {
    const cloud = CLOUDS[this.cfg.cloud.type];
    return { ...cloud, loginUrl: this.cfg.cloud.loginUrl ?? cloud.loginUrl };
  }

  /**
   * Executes `enabledMowers`.
   * @returns {{ topic: string; serial: string; enabled: boolean; }[]} Result.
   */
  private get enabledMowers() {
    return this.cfg.mower.filter((mower) => mower.enabled);
  }

  /**
   * Executes `start`.
   * @returns {Promise<void>} Result.
   */
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

  /**
   * Executes `login`.
   * @returns {Promise<boolean>} Result.
   */
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
        { headers: this.authHeaders(), signal: controller.signal },
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

  /**
   * Executes `getMowers`.
   * @returns {Promise<void>} Result.
   */
  private async getMowers() {
    const controller = this.startRequest('mowers');

    try {
      const response = await this.api.get<CloudMower[]>(
        `https://${this.cloud.apiHost}/api/v2/product-items?status=1&gps_status=1`,
        { headers: this.authorizedHeaders(), signal: controller.signal },
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

  /** The cloud no longer supports GET /users/me; every product item contains its owner ID.
   * @returns {boolean} Result.
   */
  private setUserFromMowers() {
    const mower = this.cloudMowers.values().next().value as CloudMower | undefined;
    if (!mower?.user_id) {
      this.logger.warn('Could not determine the Landroid cloud user from the configured mowers.');
      return false;
    }

    this.user = { id: mower.user_id };
    return true;
  }

  /**
   * Executes `scheduleTokenRefresh`.
   * @returns {void} Result.
   */
  private scheduleTokenRefresh() {
    if (!this.token || this.destroyed) return;

    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const timeout = Math.max((this.token.expires_in - 100) * 1_000, 60_000);
    this.refreshTimer = setTimeout(() => void this.refreshToken(), timeout);
  }

  /**
   * Executes `refreshToken`.
   * @returns {Promise<void>} Result.
   */
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
        { headers: this.authHeaders(), signal: controller.signal },
      );
      if (controller.signal.aborted || this.destroyed) return;

      this.token = response.data;
      await this.persistAuthentication();
      this.cloudClient?.updateCustomAuthHeaders?.(this.createCloudHeaders());
      this.scheduleTokenRefresh();
    } catch (error) {
      this.handleCloudRequestError('Failed to refresh Landroid cloud token.', controller, error);
    } finally {
      this.finishRequest('refresh-token', controller);
    }
  }

  /**
   * Executes `authenticationFile`.
   * @returns {string} Result.
   */
  private get authenticationFile() {
    const topicHash = createHash('sha256').update(this.cfg.topic).digest('hex').slice(0, 12);
    const file = this.cfg.authFile ?? `.landroid-${topicHash}.auth.json`;
    return path.isAbsolute(file) ? file : path.resolve(ENV.CONFIG_PATH, file);
  }

  /**
   * Executes `loadAuthentication`.
   * @returns {Promise<boolean>} Result.
   */
  private async loadAuthentication() {
    try {
      const value = JSON.parse(await readFile(this.authenticationFile, 'utf8')) as Partial<CloudAuthentication>;
      if (!value.token || typeof value.token.refresh_token !== 'string' || typeof value.expiresAt !== 'number')
        return false;
      this.token = value.token;
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        this.logger.warn('Could not load Landroid authentication file.');
      return false;
    }
  }

  /**
   * Executes `persistAuthentication`.
   * @returns {Promise<void>} Result.
   */
  private async persistAuthentication() {
    if (!this.token?.refresh_token) return;
    const file = this.authenticationFile;
    const temporary = `${file}.${process.pid}.tmp`;
    const value: CloudAuthentication = { expiresAt: Date.now() + this.token.expires_in * 1000, token: this.token };
    try {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(temporary, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, file);
      await chmod(file, 0o600);
    } catch {
      this.logger.warn('Could not persist Landroid authentication file.');
    }
  }
  //#endregion

  //#region state
  /**
   * Executes `updateMowers`.
   * @returns {Promise<void>} Result.
   */
  private async updateMowers() {
    if (!this.token || this.destroyed) return;

    for (const mower of this.enabledMowers) {
      if (!this.cloudMowers.has(mower.serial)) continue;
      await this.updateMower(mower.serial);
    }
  }

  /**
   * Executes `updateMower`.
   * @param {string} serial The serial value.
   * @returns {Promise<void>} Result.
   */
  private async updateMower(serial: string) {
    const controller = this.startRequest(`mower:${serial}`);

    try {
      const response = await this.api.get<CloudMower>(
        `https://${this.cloud.apiHost}/api/v2/product-items/${serial}/?status=1&gps_status=1`,
        { headers: this.authorizedHeaders(), signal: controller.signal },
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

  /**
   * Executes `publishMowerData`.
   * @param {string} serial The serial value.
   * @param {unknown} data The data value.
   * @returns {void} Result.
   */
  private publishMowerData(serial: string, data: unknown) {
    const mower = this.enabledMowers.find((candidate) => candidate.serial === serial);
    if (!mower) return;

    this.mqtt.publish(`${mower.topic}/mowerdata`, JSON.stringify(data));
    this.publishConfiguration(mower.topic, getRecord(data)?.cfg);
  }

  /**
   * Executes `publishConfiguration`.
   * @param {string} topic The topic value.
   * @param {unknown} cfg The cfg value.
   * @returns {void} Result.
   */
  private publishConfiguration(topic: string, cfg: unknown) {
    for (const [path, value] of mapConfigurationToMqtt(getRecord(cfg))) {
      this.mqtt.publish(`${topic}/configuration/${path}`, value);
    }
  }

  /**
   * Executes `setMowerOnline`.
   * @param {string} serial The serial value.
   * @param {boolean} online The online value.
   * @returns {void} Result.
   */
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
  /**
   * Executes `connectCloudMqtt`.
   * @returns {void} Result.
   */
  private connectCloudMqtt() {
    const firstMower = this.cloudMowers.values().next().value as CloudMower | undefined;
    if (!firstMower || !this.user || this.destroyed) return;

    const endpoint = firstMower.mqtt_endpoint ?? DEFAULT_MQTT_ENDPOINT;
    const clientId = `${this.cloud.mqttPrefix}/USER/${this.user.id}/mqtt-bridges/${firstMower.uuid ?? crypto.randomUUID()}`;
    const options = {
      baseReconnectTimeMs: 5_000,
      clientId,
      customAuthHeaders: this.createCloudHeaders(),
      host: endpoint,
      protocol: 'wss-custom-auth',
      region: this.getEndpointRegion(endpoint),
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

  /**
   * Executes `handleCloudMessage`.
   * @param {string} topic The topic value.
   * @param {Buffer<ArrayBufferLike>} payload The payload value.
   * @returns {void} Result.
   */
  private handleCloudMessage(topic: string, payload: Buffer) {
    const mower = [...this.cloudMowers.values()].find((candidate) => candidate.mqtt_topics?.command_out === topic);
    if (!mower) return;

    this.setMowerOnline(mower.serial_number, true);
    const message = payload.toString();
    this.mqtt.publish(`${this.getMowerTopic(mower.serial_number)}/mowerdata`, message);

    try {
      const data = JSON.parse(message) as Record<string, unknown>;
      this.cloudMowers.set(mower.serial_number, { ...mower, last_status: { payload: data } });
      this.publishConfiguration(this.getMowerTopic(mower.serial_number), data.cfg);
    } catch {
      this.logger.warn('Received invalid JSON from Landroid cloud MQTT.');
    }
  }

  /**
   * Executes `createCloudHeaders`.
   * @returns {{ 'x-amz-customauthorizer-name': string; 'x-amz-customauthorizer-signature': string; jwt: string; }} Result.
   */
  private createCloudHeaders() {
    if (!this.token) throw new Error('Landroid cloud access token is unavailable.');

    const [header, payload, signature] = this.token.access_token.replace(/_/g, '/').replace(/-/g, '+').split('.');
    if (!header || !payload || !signature) throw new Error('Landroid cloud access token is invalid.');

    return {
      'x-amz-customauthorizer-name': 'com-worxlandroid-customer',
      'x-amz-customauthorizer-signature': signature,
      jwt: `${header}.${payload}`,
    };
  }
  //#endregion

  //#region commands
  /**
   * Executes `subscribeCommands`.
   * @param {{ topic: string; serial: string; enabled: boolean; }} mower The mower value.
   * @returns {void} Result.
   */
  private subscribeCommands(mower: LandroidConfig['mower'][number]) {
    const commandTopic = `${mower.topic}/set/json`;
    this.subscribe(commandTopic, (_, payload) => {
      if (payload === '') return;

      try {
        const command = JSON.parse(payload) as Record<string, unknown>;
        if (typeof command !== 'object' || command === null || Array.isArray(command)) {
          throw new Error('A Landroid command must be a JSON object.');
        }

        void this.sendCommand(mower.serial, command);
        this.mqtt.publish(commandTopic, null);
      } catch (error) {
        this.logError(`Invalid Landroid command on ${commandTopic}.`, error);
      }
    });
  }

  /**
   * Executes `sendCommand`.
   * @param {string} serial The serial value.
   * @param {Record<string, unknown>} command The command value.
   * @returns {Promise<void>} Result.
   */
  private async sendCommand(serial: string, command: Record<string, unknown>) {
    const mower = this.cloudMowers.get(serial);
    if (!mower?.mqtt_topics || !this.cloudClient || !this.mowerOnline.get(serial)) {
      this.logger.warn(`Ignoring command for offline Landroid mower ${serial}.`);
      this.setMowerOnline(serial, false);
      return;
    }

    const cfg = mower.last_status?.payload?.cfg;
    const language = cfg && typeof cfg === 'object' ? (cfg as Record<string, unknown>).lg : undefined;
    const now = new Date();
    const envelope = {
      cmd: 0,
      dt: `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
      id: 1_024 + Math.floor(Math.random() * 64_510),
      lg: typeof language === 'string' ? language : 'de',
      sn: serial,
      tm: now.toTimeString().slice(0, 8),
      ...command,
    };

    this.cloudClient.publish(mower.mqtt_topics.command_in, JSON.stringify(envelope), { qos: 1 });
  }
  //#endregion

  /**
   * Executes `getMowerTopic`.
   * @param {string} serial The serial value.
   * @returns {string} Result.
   */
  private getMowerTopic(serial: string) {
    return this.enabledMowers.find((mower) => mower.serial === serial)?.topic ?? serial;
  }

  /**
   * Executes `authHeaders`.
   * @returns {{ accept: string; 'accept-language': string; 'content-type': string; 'user-agent': string; }} Result.
   */
  private authHeaders() {
    return {
      accept: 'application/json',
      'accept-language': 'de-de',
      'content-type': 'application/json',
      'user-agent': 'mqtt-bridges',
    };
  }

  /**
   * Executes `authorizedHeaders`.
   * @returns {{ authorization: string; accept: string; 'accept-language': string; 'content-type': string; 'user-agent': string; }} Result.
   */
  private authorizedHeaders() {
    if (!this.token) throw new Error('Landroid cloud access token is unavailable.');

    return { ...this.authHeaders(), authorization: `Bearer ${this.token.access_token}` };
  }

  /**
   * Executes `getEndpointRegion`.
   * @param {string} endpoint The endpoint value.
   * @returns {string} Result.
   */
  private getEndpointRegion(endpoint: string) {
    const parts = endpoint.split('.');
    return parts.length === 3 ? parts[2] : 'eu-west-1';
  }

  /**
   * Executes `handleCloudRequestError`.
   * @param {string} message The message value.
   * @param {AbortController} controller The controller value.
   * @param {unknown} error The error value.
   * @returns {void} Result.
   */
  private handleCloudRequestError(message: string, controller: AbortController, error: unknown) {
    if (controller.signal.aborted || this.destroyed) return;

    this.logError(message, error);
  }

  /** Logs only the message because Axios error objects may include request credentials.
   * @param {string} message The message value.
   * @param {unknown} error The error value.
   * @returns {void} Result.
   */
  private logError(message: string, error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    this.logger.error(`${message} ${detail}`);
  }
}

/**
 * Executes `getRecord`.
 * @param {unknown} value The value value.
 * @returns {Record<string, unknown> | undefined} Result.
 */
function getRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/**
 * Executes `isEnabled`.
 * @param {unknown} value The value value.
 * @returns {boolean} Result.
 */
