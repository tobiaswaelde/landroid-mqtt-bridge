import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';

/** Registers the process liveness endpoint. */
@Module({ controllers: [HealthController] })
export class HealthModule {}
