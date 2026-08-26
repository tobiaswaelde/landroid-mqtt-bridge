import { z } from 'zod';

import { commonSchema, instanceSchema, loadConfig } from './runtime';

const inputInstance = instanceSchema
  .extend({
    authFile: z.string().min(1).optional(),
    cloud: z.object({
      type: z.enum(['worx', 'kress', 'landxcape', 'ferrex']).default('worx'),
      email: z.email(),
      password: z.string().min(1),
      loginUrl: z.url().optional(),
    }),
    mowers: z.array(z.object({ serial: z.string().min(1), enabled: z.boolean().default(true) })).min(1),
    updateInterval: z.number().positive().default(60000),
  })
  .transform(({ mowers, ...instance }) => ({
    ...instance,
    mower: mowers.map((mower) => ({ ...mower, topic: `${instance.topic}/mowers/${mower.serial}` })),
  }));

export const configSchema = commonSchema
  .extend({ instances: z.array(inputInstance).min(1) })
  .superRefine((value, ctx) => unique(value.instances, ctx));

/** Rejects duplicate instance IDs and MQTT roots before the bridge starts. */
function unique(instances: { id: string; topic: string }[], ctx: z.RefinementCtx) {
  for (const [index, entry] of instances.entries())
    for (let prior = 0; prior < index; prior++)
      if (instances[prior].id === entry.id || instances[prior].topic === entry.topic)
        ctx.addIssue({ code: 'custom', path: ['instances', index], message: 'instance id and topic must be unique' });
}

export type LandroidConfig = z.infer<typeof configSchema>['instances'][number];

export const CONFIG = loadConfig(configSchema);
