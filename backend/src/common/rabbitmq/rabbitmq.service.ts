import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as amqp from 'amqplib';
import { HEALTHCLAIM_EVENTS_EXCHANGE } from '@healthclaim/shared';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private isConnected = false;
  private readonly exchange = HEALTHCLAIM_EVENTS_EXCHANGE;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.initBroker();
  }

  private async initBroker(): Promise<void> {
    const rabbitUrl = this.configService.get<string>(
      'RABBITMQ_URL',
      'amqp://healthclaim_mq:healthclaim_mq_pass@localhost:5672',
    );

    try {
      this.connection = await amqp.connect(rabbitUrl);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });

      this.isConnected = true;
      this.logger.log(`Connected to RabbitMQ broker and asserted topic exchange: "${this.exchange}"`);

      this.connection.on('error', (err) => {
        this.logger.warn(`RabbitMQ connection error: ${err.message}. Engaging in-memory event bus.`);
        this.isConnected = false;
      });

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed. In-memory fallback active.');
        this.isConnected = false;
      });
    } catch (err: any) {
      this.logger.warn(`Failed to connect to RabbitMQ (${err.message}). In-memory EventEmitter fallback active.`);
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch {
      // ignore
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async publishEvent<T extends object>(routingKey: string, event: T): Promise<boolean> {
    const payload = Buffer.from(JSON.stringify(event));

    if (this.isConnected && this.channel) {
      try {
        const published = this.channel.publish(this.exchange, routingKey, payload, {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now(),
        });
        this.logger.debug(`[AMQP Published] Exchange: "${this.exchange}", Key: "${routingKey}"`);
        return published;
      } catch (err: any) {
        this.logger.warn(`AMQP publish failed: ${err.message}. Emitting to in-memory bus.`);
      }
    }

    // In-memory fallback
    this.eventEmitter.emit(routingKey, event);
    this.logger.debug(`[InMemory Emitted] Key: "${routingKey}"`);
    return true;
  }

  async subscribe<T extends object>(
    queueName: string,
    routingKeys: string[],
    handler: (event: T, ack: () => void, nack: (requeue?: boolean) => void) => Promise<void>,
  ): Promise<void> {
    if (this.isConnected && this.channel) {
      try {
        await this.channel.assertQueue(queueName, { durable: true });
        for (const key of routingKeys) {
          await this.channel.bindQueue(queueName, this.exchange, key);
        }

        await this.channel.consume(
          queueName,
          async (msg) => {
            if (!msg) return;
            const ack = () => this.channel?.ack(msg);
            const nack = (requeue = false) => this.channel?.nack(msg, false, requeue);

            try {
              const content = JSON.parse(msg.content.toString()) as T;
              await handler(content, ack, nack);
            } catch (err: any) {
              this.logger.error(`Error processing message from queue "${queueName}": ${err.message}`);
              nack(false); // Reject without requeue to avoid poison message loops
            }
          },
          { noAck: false },
        );

        this.logger.log(`Subscribed to queue "${queueName}" on keys [${routingKeys.join(', ')}]`);
        return;
      } catch (err: any) {
        this.logger.warn(`AMQP subscribe failed on queue "${queueName}": ${err.message}.`);
      }
    }

    // In-memory fallback subscription
    for (const key of routingKeys) {
      this.eventEmitter.on(key, async (event: T) => {
        try {
          await handler(event, () => {}, () => {});
        } catch (err: any) {
          this.logger.error(`Error processing in-memory event "${key}": ${err.message}`);
        }
      });
    }
  }
}
