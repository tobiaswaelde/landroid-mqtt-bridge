import { objectToMap } from '~/util/object';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Publishes a mower configuration as MQTT-compatible scalar values.
 * @param {Record<string, unknown> | undefined} cfg Raw mower configuration.
 * @returns {Map<string, unknown>} MQTT paths and values.
 */
export function mapConfigurationToMqtt(cfg: Record<string, unknown> | undefined) {
  return objectToMap(mapConfiguration(cfg));
}

/** Converts a cloud mower configuration to a stable, descriptive object.
 * @param {Record<string, unknown> | undefined} cfg Raw mower configuration.
 * @returns {Record<string, unknown>} Normalized configuration.
 */
function mapConfiguration(cfg: Record<string, unknown> | undefined) {
  if (!cfg) return {};

  const schedule = getRecord(cfg.sc);
  const autoLock = getRecord(cfg.al);
  const modules = getRecord(cfg.modules);
  const digitalFence = getRecord(modules?.DF);
  const acs = getRecord(modules?.US);

  return withoutUndefined({
    autoLock: autoLock ? withoutUndefined({ level: autoLock.lvl, timeout: autoLock.t }) : undefined,
    command: cfg.cmd,
    date: cfg.dt,
    language: cfg.lg,
    modules:
      digitalFence || acs
        ? withoutUndefined({
            antiCollisionSystem: acs ? { enabled: isEnabled(acs.enabled) } : undefined,
            offLimits: digitalFence
              ? { enabled: isEnabled(digitalFence.cut), shortcutsEnabled: isEnabled(digitalFence.fh) }
              : undefined,
          })
        : undefined,
    multiZone: withoutUndefined({
      enabled: cfg.mzk === undefined ? undefined : isEnabled(cfg.mzk),
      startingPoints: mapNumberedValues(cfg.mz, 'zone'),
      zoneIndices: mapNumberedValues(cfg.mzv, 'zone'),
    }),
    rainDelayMinutes: cfg.rd,
    requestId: cfg.id,
    schedules: schedule
      ? withoutUndefined({
          active: schedule.m === undefined ? undefined : isEnabled(schedule.m),
          distanceMode: schedule.distm,
          oneTime: getRecord(schedule.ots)
            ? withoutUndefined({
                boundaryCut: isEnabled(getRecord(schedule.ots)?.bc),
                durationMinutes: getRecord(schedule.ots)?.wtm,
              })
            : undefined,
          primary: mapWeeklySchedule(schedule.d),
          secondary: mapWeeklySchedule(schedule.dd),
          timeExtensionPercent: schedule.p,
        })
      : undefined,
    serialNumber: cfg.sn,
    time: cfg.tm,
    torquePercent: cfg.tq,
  });
}

/** Maps cloud weekly schedule tuples to named weekdays.
 * @param {unknown} value Cloud schedule value.
 * @returns {Record<string, Record<string, unknown>> | undefined} Normalized schedule.
 */
function mapWeeklySchedule(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return Object.fromEntries(
    value.flatMap((entry, index) => {
      if (!Array.isArray(entry) || !WEEKDAYS[index]) return [];
      return [
        [
          WEEKDAYS[index],
          withoutUndefined({
            boundaryCut: entry[2] === undefined ? undefined : isEnabled(entry[2]),
            durationMinutes: entry[1],
            startTime: entry[0],
          }),
        ],
      ];
    }),
  );
}

/** Maps a cloud array to numbered MQTT property names.
 * @param {unknown} value Cloud array value.
 * @param {string} prefix Property-name prefix.
 * @returns {Record<string, unknown> | undefined} Numbered values.
 */
function mapNumberedValues(value: unknown, prefix: string) {
  if (!Array.isArray(value)) return undefined;
  return Object.fromEntries(value.map((item, index) => [`${prefix}${index + 1}`, item]));
}

/** Narrows a runtime value to a record.
 * @param {unknown} value Runtime value.
 * @returns {Record<string, unknown> | undefined} Record or undefined.
 */
function getRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/** Normalizes cloud boolean encodings.
 * @param {unknown} value Cloud value.
 * @returns {boolean} Whether the value represents enabled.
 */
function isEnabled(value: unknown) {
  return value === 1 || value === '1' || value === true;
}

/** Removes undefined properties from an object.
 * @param {Record<string, unknown>} object Source object.
 * @returns {Record<string, unknown>} Object without undefined values.
 */
function withoutUndefined(object: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}
