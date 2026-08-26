/** Public command names mapped to the numeric codes required by the vendor cloud. */
export const MOWER_COMMAND_CODES = {
  home: 3,
  lock: 5,
  pause: 2,
  start: 1,
  stop: 2,
  unlock: 6,
  zone_training: 4,
} as const;

/** Parses a public command object and replaces its string command name with the cloud code. */
export function parseMowerCommand(payload: string): Record<string, unknown> {
  const command = JSON.parse(payload) as unknown;
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    throw new Error('A Landroid command must be a JSON object.');
  }

  const { cmd, ...parameters } = command as Record<string, unknown>;
  if (typeof cmd !== 'string' || !Object.hasOwn(MOWER_COMMAND_CODES, cmd)) {
    throw new Error(`Unknown Landroid command: ${String(cmd)}.`);
  }

  return { ...parameters, cmd: MOWER_COMMAND_CODES[cmd as keyof typeof MOWER_COMMAND_CODES] };
}

/** Adds the envelope fields required by the Landroid cloud MQTT protocol. */
export function createMowerCommand(
  serial: string,
  language: unknown,
  command: Record<string, unknown>,
  now = new Date(),
): Record<string, unknown> {
  return {
    cmd: 0,
    dt: `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
    id: 1_024 + Math.floor(Math.random() * 64_510),
    lg: typeof language === 'string' ? language : 'de',
    sn: serial,
    tm: now.toTimeString().slice(0, 8),
    ...command,
  };
}
