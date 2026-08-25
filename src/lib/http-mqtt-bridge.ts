import { Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import type { MqttBridgeClient, MqttMessageHandler } from '~/modules/mqtt/mqtt.service';
export interface BridgeInstance {
  setup(): void;
  loop(time: number): void;
  destroy(): void;
}
/**
 * Executes `HttpMqttBridge`.
 * @typeParam T Generic type parameter `T`.
 */
export abstract class HttpMqttBridge<T extends object> implements BridgeInstance {
  protected readonly api: AxiosInstance;
  protected readonly logger: Logger;
  private readonly requests = new Map<string, AbortController>();
  private readonly unsubscribers = new Set<() => void>();
  private readonly tasks = new Map<string, { interval: number; last: number; task: () => void | Promise<void> }>();
  /**
   * Creates the class instance.
   * @param {T} cfg The cfg value.
   * @param {MqttBridgeClient} mqtt The mqtt value.
   * @param {string} scope The scope value.
   * @param {string} baseURL The baseURL value.
   */
  protected constructor(
    protected readonly cfg: T,
    protected readonly mqtt: MqttBridgeClient,
    scope: string,
    baseURL: string,
  ) {
    this.logger = new Logger(scope);
    this.api = axios.create({ baseURL });
  }
  /**
   * Executes `setup`.
   * @returns {void} Result.
   */
  abstract setup(): void;
  /**
   * Executes `loop`.
   * @param {number} time The time value.
   * @returns {void} Result.
   */
  loop(time: number) {
    for (const task of this.tasks.values())
      if (time - task.last >= task.interval) {
        task.last = time;
        void task.task();
      }
  }
  /**
   * Executes `destroy`.
   * @returns {void} Result.
   */
  destroy() {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    for (const controller of this.requests.values()) controller.abort();
    this.unsubscribers.clear();
    this.requests.clear();
    this.tasks.clear();
  }
  /**
   * Executes `subscribe`.
   * @param {string} topic The topic value.
   * @param {MqttMessageHandler} handler The handler value.
   * @returns {() => void} Result.
   */
  protected subscribe(topic: string, handler: MqttMessageHandler) {
    const unsubscribe = this.mqtt.subscribe(topic, handler);
    this.unsubscribers.add(unsubscribe);
    return unsubscribe;
  }
  /**
   * Executes `poll`.
   * @param {string} key The key value.
   * @param {number} interval The interval value.
   * @param {() => void | Promise<void>} task The task value.
   * @returns {void} Result.
   */
  protected poll(key: string, interval: number, task: () => void | Promise<void>) {
    this.tasks.set(key, { interval, last: 0, task });
  }
  /**
   * Executes `startRequest`.
   * @param {string} key The key value.
   * @returns {AbortController} Result.
   */
  protected startRequest(key: string) {
    this.requests.get(key)?.abort();
    const controller = new AbortController();
    this.requests.set(key, controller);
    return controller;
  }
  /**
   * Executes `finishRequest`.
   * @param {string} key The key value.
   * @param {AbortController} controller The controller value.
   * @returns {void} Result.
   */
  protected finishRequest(key: string, controller: AbortController) {
    if (this.requests.get(key) === controller) this.requests.delete(key);
  }
  /**
   * Executes `cancelRequest`.
   * @param {string} key The key value.
   * @returns {void} Result.
   */
  protected cancelRequest(key: string) {
    this.requests.get(key)?.abort();
    this.requests.delete(key);
  }
}
