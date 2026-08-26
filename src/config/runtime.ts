import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { load } from 'js-yaml';
import { z } from 'zod';

export const instanceSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[^/\s]+$/, 'id must not contain / or whitespace'),
  enabled: z.boolean().default(true),
  topic: z.string().min(1),
});

export const commonSchema = z.object({
  mqtt: z.object({
    protocol: z.enum(['mqtt', 'mqtts']).default('mqtt'),
    host: z.string().min(1),
    port: z.number().int().positive().default(1883),
    clientId: z.string(),
    username: z.string().optional(),
    password: z.string().optional(),
    keepAliveSeconds: z.number().int().positive().default(30),
    reconnectDelayMs: z.number().int().positive().default(5000),
  }),
});

/** Resolves the configuration file from the environment, CLI, or default path. */
export function configFilePath() {
  const index = process.argv.indexOf('--config');
  return path.resolve(process.env.CONFIG_FILE ?? (index >= 0 ? process.argv[index + 1] : 'config/config.yml'));
}

/** Returns the directory that contains the resolved configuration file. */
export function configDirectory() {
  return path.dirname(configFilePath());
}

/** Loads and validates YAML configuration against a Zod schema. */
export function loadConfig<T extends z.ZodType>(schema: T): z.infer<T> {
  const file = configFilePath();
  if (!existsSync(file)) throw new Error(`Configuration file not found: ${file}`);
  return schema.parse(load(readFileSync(file, 'utf8')));
}
