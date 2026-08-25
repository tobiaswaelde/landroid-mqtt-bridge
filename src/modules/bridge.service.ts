import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CONFIG, type LandroidConfig } from '~/config/config';
import type { BridgeInstance } from '~/lib/http-mqtt-bridge';
import { Landroid } from '~/lib/landroid';
import { MqttService } from '~/modules/mqtt/mqtt.service';
/**
 * Executes `BridgeService`.
 */
@Injectable()
export class BridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly instances: BridgeInstance[];
  private timer?: NodeJS.Timeout;
  /**
   * Creates the class instance.
   * @param mqtt - Value of type `MqttService`.
   */
  constructor(mqtt: MqttService) {
    this.instances = CONFIG.instances
      .filter((instance) => instance.enabled)
      .map((instance) => new Landroid(instance as LandroidConfig, mqtt));
  }
  /**
   * Executes `onModuleInit`.
   * @returns Result of type `void`.
   */
  onModuleInit() {
    this.instances.forEach((instance) => instance.setup());
    this.timer = setInterval(() => this.instances.forEach((instance) => instance.loop(Date.now())), 1000);
  }
  /**
   * Executes `onModuleDestroy`.
   * @returns Result of type `void`.
   */
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.instances.forEach((instance) => instance.destroy());
  }
}
