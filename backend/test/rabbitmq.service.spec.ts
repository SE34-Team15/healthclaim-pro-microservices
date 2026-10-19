import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RabbitMQService } from '../src/common/rabbitmq/rabbitmq.service';
import { DomainRoutingKey } from '@healthclaim/shared';

describe('RabbitMQService', () => {
  let service: RabbitMQService;
  let mockConfigService: Partial<ConfigService>;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    mockConfigService = {
      get: vi.fn((key: string, defaultVal?: any) => defaultVal),
    };
    eventEmitter = new EventEmitter2();

    service = new RabbitMQService(mockConfigService as ConfigService, eventEmitter);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined and fallback to in-memory event bus when broker offline', () => {
    expect(service).toBeDefined();
    expect(service.connected).toBe(false);
  });

  it('should publish event through in-memory fallback successfully', async () => {
    const published = await service.publishEvent(DomainRoutingKey.CLAIM_SUBMITTED, {
      claimId: 'test-claim-uuid',
      totalAmount: 150.0,
    });
    expect(published).toBe(true);
  });

  it('should subscribe and receive events across in-memory channel', async () => {
    let receivedPayload: any = null;

    await service.subscribe('test.queue', [DomainRoutingKey.CLAIM_SUBMITTED], async (event, ack) => {
      receivedPayload = event;
      ack();
    });

    await service.publishEvent(DomainRoutingKey.CLAIM_SUBMITTED, {
      claimId: 'sub-test-123',
      amount: 88.5,
    });

    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload.claimId).toBe('sub-test-123');
    expect(receivedPayload.amount).toBe(88.5);
  });
});
