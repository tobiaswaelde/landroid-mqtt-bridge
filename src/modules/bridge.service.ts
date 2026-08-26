import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { CONFIG } from '~/config/config';
import type { BridgeInstance } from '~/lib/http-mqtt-bridge';
import { Landroid } from '~/lib/landroid';
import { MqttService } from '~/modules/mqtt/mqtt.service';

/** Creates configured bridges and advances their polling lifecycle. */
@Injectable()
export class BridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly instances: BridgeInstance[];
  private timer?: NodeJS.Timeout;
  /** Creates one bridge for each enabled account instance. */
  constructor(@Inject(MqttService) mqtt: MqttService) {
    this.instances = CONFIG.instances
      .filter((instance) => instance.enabled)
      .map((instance) => new Landroid(instance, mqtt));
  }

  /** Starts every bridge and the shared lightweight polling timer. */
  onModuleInit() {
    this.instances.forEach((instance) => instance.setup());
    this.timer = setInterval(() => this.instances.forEach((instance) => instance.loop(Date.now())), 1000);
  }
  /** Stops polling before each bridge closes its subscriptions and network resources. */
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.instances.forEach((instance) => instance.destroy());
  }
}
