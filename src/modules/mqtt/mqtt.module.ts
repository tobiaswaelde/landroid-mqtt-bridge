import { Module } from '@nestjs/common';

import { MqttService } from './mqtt.service';

/** Provides one shared MQTT client to all bridge instances. */
@Module({ providers: [MqttService], exports: [MqttService] })
export class MqttModule {}
