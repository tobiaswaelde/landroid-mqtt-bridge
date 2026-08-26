import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ENV } from '~/config/env';

import type { CloudAuthentication, CloudToken } from './cloud';

interface AuthenticationConfig {
  authFile?: string;
  topic: string;
}

/** Resolves the private, per-instance authentication-file path. */
export function authenticationFile(config: AuthenticationConfig): string {
  const topicHash = createHash('sha256').update(config.topic).digest('hex').slice(0, 12);
  const file = config.authFile ?? `.landroid-${topicHash}.auth.json`;

  return path.isAbsolute(file) ? file : path.resolve(ENV.CONFIG_PATH, file);
}

/** Loads a persisted refresh token, if the file exists and has the expected shape. */
export async function loadAuthentication(file: string): Promise<CloudToken | undefined> {
  try {
    const value = JSON.parse(await readFile(file, 'utf8')) as Partial<CloudAuthentication>;

    return value.token && typeof value.token.refresh_token === 'string' && typeof value.expiresAt === 'number'
      ? value.token
      : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;

    throw error;
  }
}

/** Atomically persists only the token data required for a later refresh. */
export async function persistAuthentication(file: string, token: CloudToken): Promise<void> {
  const temporary = `${file}.${process.pid}.tmp`;
  const value: CloudAuthentication = {
    expiresAt: Date.now() + token.expires_in * 1_000,
    token,
  };

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(temporary, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, file);
  await chmod(file, 0o600);
}
