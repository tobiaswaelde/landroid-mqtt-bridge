import { authenticationHeaders, authorizedHeaders, cloudHeaders, endpointRegion } from './headers';

const token = {
  access_token: 'header.payload.signature',
  expires_in: 3_600,
  refresh_token: 'refresh-token',
};

describe('cloud headers', () => {
  it('creates the expected REST and AWS IoT authorization headers', () => {
    expect(authenticationHeaders()).toMatchObject({
      accept: 'application/json',
      'content-type': 'application/json',
    });
    expect(authorizedHeaders(token).authorization).toBe('Bearer header.payload.signature');
    expect(cloudHeaders(token)).toEqual({
      'x-amz-customauthorizer-name': 'com-worxlandroid-customer',
      'x-amz-customauthorizer-signature': 'signature',
      jwt: 'header.payload',
    });
  });

  it('uses the endpoint region when present and retains the historical fallback', () => {
    expect(endpointRegion('iot.us-east-1.worxlandroid.com')).toBe('us-east-1');
    expect(endpointRegion('not-a-region.example')).toBe('eu-west-1');
  });
});
