import { Controller, Get } from '@nestjs/common';

/** Exposes a process-level liveness endpoint for Docker and orchestrators. */
@Controller('health')
export class HealthController {
  /** Reports basic process metadata without checking vendor-cloud connectivity. */
  @Get() getHealth() {
    return {
      status: 'ok',
      name: process.env.npm_package_name ?? 'landroid-mqtt-bridge',
      version: process.env.npm_package_version ?? '0.0.0',
      uptime: process.uptime(),
    };
  }
}
