/** Known cloud endpoints and client identifiers per Landroid-compatible brand. */
export const CLOUDS = {
  ferrex: {
    apiHost: 'api.watermelon.smartmower.cloud',
    clientId: '10078D10-3840-474A-848A-5EED949AB0FC',
    loginUrl: 'https://id.watermelon.smartmower.cloud',
    mqttPrefix: 'FE',
  },
  kress: {
    apiHost: 'api.kress-robotik.com',
    clientId: '931d4bc4-3192-405a-be78-98e43486dc59',
    loginUrl: 'https://id.kress.com',
    mqttPrefix: 'KR',
  },
  landxcape: {
    apiHost: 'api.landxcape-services.com',
    clientId: 'dec998a9-066f-433b-987a-f5fc54d3af7c',
    loginUrl: 'https://id.landxcape-services.com',
    mqttPrefix: 'LX',
  },
  worx: {
    apiHost: 'api.worxlandroid.com',
    clientId: '150da4d2-bb44-433b-9429-3773adc70a2a',
    loginUrl: 'https://id.worx.com',
    mqttPrefix: 'WX',
  },
} as const;

/** Default AWS IoT endpoint when the mower API does not provide one. */
export const DEFAULT_MQTT_ENDPOINT = 'iot.eu-west-1.worxlandroid.com';

/** OAuth token returned by a Landroid-compatible cloud. */
export interface CloudToken {
  access_token: string;
  expires_in: number;
  refresh_token: string;
}

/** Persisted Landroid-compatible cloud authentication data. */
export interface CloudAuthentication {
  expiresAt: number;
  token: CloudToken;
}

/** Authenticated cloud account identity. */
export interface CloudUser {
  id: string;
}

/** Mower data consumed from the cloud REST and MQTT APIs. */
export interface CloudMower {
  last_status?: { payload?: Record<string, unknown> };
  mqtt_endpoint?: string;
  mqtt_topics?: {
    command_in: string;
    command_out: string;
  };
  online?: boolean;
  serial_number: string;
  uuid?: string;
  user_id?: string;
}

/** Minimal AWS IoT client contract used by the bridge. */
export interface CloudClient {
  updateCustomAuthHeaders?: (headers: Record<string, string>) => void;
  end(force?: boolean): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  publish(topic: string, payload: string, options?: { qos: number }): void;
  subscribe(topic: string, options?: { qos: number }): void;
}
