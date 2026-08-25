const mockAxiosCreate = jest.fn(() => ({ defaults: {} }));
const mockPublish = jest.fn();
const mockSubscribe = jest.fn(() => jest.fn());

jest.mock('axios', () => ({ __esModule: true, default: { create: mockAxiosCreate } }));
jest.mock('http-cookie-agent/http', () => ({ HttpsCookieAgent: jest.fn(() => ({ destroy: jest.fn() })) }));
jest.mock('tough-cookie', () => ({ CookieJar: jest.fn() }));
jest.mock('aws-iot-device-sdk', () => ({ __esModule: true, default: { device: jest.fn() } }));

import type { MqttBridgeClient } from '~/modules/mqtt/mqtt.service';
import { Landroid } from './index';

describe('Landroid', () => {
  it('publishes initial availability and subscribes to every configured mower command topic', () => {
    const bridge = new Landroid(
      {
        authFile: `/tmp/landroid-test-${process.pid}.json`,
        cloud: { email: 'mower@example.com', password: 'secret', type: 'worx' },
        enabled: true,
        id: 'garden',
        mower: [{ enabled: true, serial: 'serial-1', topic: 'home/landroid/garden/mowers/serial-1' }],
        topic: 'home/landroid/garden',
        updateInterval: 60_000,
      },
      { publish: mockPublish, subscribe: mockSubscribe } as MqttBridgeClient,
    );

    bridge.setup();

    expect(mockPublish).toHaveBeenCalledWith('home/landroid/garden/connected', false);
    expect(mockPublish).toHaveBeenCalledWith(
      'home/landroid/garden/mowers/serial-1/status',
      JSON.stringify({ online: false }),
    );
    expect(mockSubscribe).toHaveBeenCalledWith('home/landroid/garden/mowers/serial-1/set/json', expect.any(Function));

    bridge.destroy();
  });
});
