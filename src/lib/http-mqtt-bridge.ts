import { Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';

import type { MqttBridgeClient, MqttMessageHandler } from '~/modules/mqtt/mqtt.service';

export interface BridgeInstance {
  setup(): void;
  loop(time: number): void;
  destroy(): void;
}
/** Shared HTTP, polling, request-cancellation, and MQTT-subscription lifecycle for a bridge. */
export abstract class HttpMqttBridge<T extends object> implements BridgeInstance {
  protected readonly api: AxiosInstance;
  protected readonly logger: Logger;
  private readonly requests = new Map<string, AbortController>();
  private readonly unsubscribers = new Set<() => void>();
  private readonly tasks = new Map<string, { interval: number; last: number; task: () => void | Promise<void> }>();
  /** Creates common transport state for a concrete bridge. */
  protected constructor(
    protected readonly cfg: T,
    protected readonly mqtt: MqttBridgeClient,
    scope: string,
    baseURL: string,
  ) {
    this.logger = new Logger(scope);
    this.api = axios.create({ baseURL });
  }
  /** Starts subscriptions and device-specific work. */
  abstract setup(): void;

  /** Runs due polling tasks. */
  loop(time: number) {
    for (const task of this.tasks.values())
      if (time - task.last >= task.interval) {
        task.last = time;
        void task.task();
      }
  }
  /** Cancels active work and removes MQTT subscriptions. */
  destroy() {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    for (const controller of this.requests.values()) controller.abort();
    this.unsubscribers.clear();
    this.requests.clear();
    this.tasks.clear();
  }
  /** Registers a subscription that is automatically removed on destroy. */
  protected subscribe(topic: string, handler: MqttMessageHandler) {
    const unsubscribe = this.mqtt.subscribe(topic, handler);
    this.unsubscribers.add(unsubscribe);
    return unsubscribe;
  }
  /** Schedules an idempotent task by a stable key. */
  protected poll(key: string, interval: number, task: () => void | Promise<void>) {
    this.tasks.set(key, { interval, last: 0, task });
  }
  /** Cancels an older request for a key and returns the controller for its replacement. */
  protected startRequest(key: string) {
    this.requests.get(key)?.abort();
    const controller = new AbortController();
    this.requests.set(key, controller);
    return controller;
  }
  /** Removes a request only when it is still the latest for its key. */
  protected finishRequest(key: string, controller: AbortController) {
    if (this.requests.get(key) === controller) this.requests.delete(key);
  }
  /** Cancels and removes the current request for a key. */
  protected cancelRequest(key: string) {
    this.requests.get(key)?.abort();
    this.requests.delete(key);
  }
}
