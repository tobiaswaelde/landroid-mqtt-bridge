import { mapConfigurationToMqtt } from './configuration';

describe('mapConfigurationToMqtt', () => {
  it('publishes configuration and live battery, connection, and mower telemetry values', () => {
    const values = mapConfigurationToMqtt({
      cfg: { rd: 30, sn: 'serial-1' },
      dat: {
        act: 1,
        bt: { c: 1, nr: 42, p: 85, t: 23.5, v: 20.1 },
        conn: 'wifi',
        dmp: [1.1, 2.2, 3.3],
        fw: 3.32,
        fwb: 1,
        le: 0,
        lk: 0,
        ls: 7,
        mac: 'AABBCCDDEEFF',
        rain: { cnt: 12, s: 1 },
        rsi: -72,
        st: { b: 100, bl: 50, d: 200, wt: 300 },
      },
    });

    expect(Object.fromEntries(values)).toMatchObject({
      activityCode: 1,
      'battery/chargeCycles': 42,
      'battery/charging': true,
      'battery/percentage': 85,
      'battery/temperatureCelsius': 23.5,
      'battery/voltage': 20.1,
      connection: 'wifi',
      errorCode: 0,
      'firmware/boardVersion': 1,
      'firmware/version': 3.32,
      locked: false,
      macAddress: 'AABBCCDDEEFF',
      'orientation/yaw': 3.3,
      'rain/detected': true,
      'rain/remainingMinutes': 12,
      signalStrength: -72,
      'statistics/bladeTimeMinutes': 100,
      'statistics/boundaryWireLengthMeters': 50,
      'statistics/distance': 200,
      'statistics/distanceMeters': 200,
      'statistics/lawnPerimeter': 50,
      'statistics/mowerWorkTime': 300,
      'statistics/workingTimeMinutes': 300,
      statusCode: 7,
    });
  });
});
