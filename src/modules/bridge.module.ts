import { Module } from '@nestjs/common';

import { MqttModule } from '~/modules/mqtt/mqtt.module';
import { BridgeService } from './bridge.service';

/** Wires bridge instances to the shared local MQTT connection. */
@Module({ imports: [MqttModule], providers: [BridgeService] })
export class BridgeModule {}
