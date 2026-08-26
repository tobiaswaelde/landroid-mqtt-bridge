import { Module } from '@nestjs/common';

import { BridgeModule } from '~/modules/bridge.module';
import { HealthModule } from '~/modules/health/health.module';

/** Root Nest module for HTTP health checks and device bridges. */
@Module({ imports: [HealthModule, BridgeModule] })
export class AppModule {}
