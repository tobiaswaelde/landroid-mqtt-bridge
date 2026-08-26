import type { CloudToken } from './cloud';

/** Builds the common headers required by the vendor OAuth API. */
export function authenticationHeaders(): Record<string, string> {
  return {
    accept: 'application/json',
    'accept-language': 'de-de',
    'content-type': 'application/json',
    'user-agent': 'mqtt-bridges',
  };
}

/** Adds the current bearer token to the vendor REST API headers. */
export function authorizedHeaders(token: CloudToken | undefined): Record<string, string> {
  if (!token) throw new Error('Landroid cloud access token is unavailable.');

  return { ...authenticationHeaders(), authorization: `Bearer ${token.access_token}` };
}

/** Builds AWS IoT custom-authorizer headers from the vendor JWT. */
export function cloudHeaders(token: CloudToken | undefined): Record<string, string> {
  if (!token) throw new Error('Landroid cloud access token is unavailable.');

  const [header, payload, signature] = token.access_token.replace(/_/g, '/').replace(/-/g, '+').split('.');
  if (!header || !payload || !signature) throw new Error('Landroid cloud access token is invalid.');

  return {
    'x-amz-customauthorizer-name': 'com-worxlandroid-customer',
    'x-amz-customauthorizer-signature': signature,
    jwt: `${header}.${payload}`,
  };
}

/** Extracts the AWS region from an IoT endpoint, with the historic Worx default as a fallback. */
export function endpointRegion(endpoint: string): string {
  const region = endpoint.match(/(?:^|\.)([a-z]{2}(?:-gov)?-[a-z]+-\d+)(?:\.|$)/)?.[1];

  return region ?? 'eu-west-1';
}
