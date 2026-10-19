import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../src/common/redis/redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: vi.fn((key: string, defaultVal?: any) => {
        if (key === 'REDIS_URL') return 'redis://localhost:6379';
        return defaultVal;
      }),
    };

    service = new RedisService(mockConfigService as ConfigService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined and initialize fallback cache when Redis is offline', () => {
    expect(service).toBeDefined();
    const metrics = service.getMetrics();
    expect(metrics).toHaveProperty('hits');
    expect(metrics).toHaveProperty('misses');
    expect(metrics).toHaveProperty('hitRatio');
  });

  it('should set and get values correctly via fallback cache', async () => {
    await service.set('test-rule:1', { ruleCode: 'RULE_01', passed: true });
    const result = await service.get<{ ruleCode: string; passed: boolean }>('test-rule:1');

    expect(result).not.toBeNull();
    expect(result?.ruleCode).toBe('RULE_01');
    expect(result?.passed).toBe(true);

    const metrics = service.getMetrics();
    expect(metrics.hits).toBe(1);
    expect(metrics.misses).toBe(0);
    expect(metrics.hitRatio).toBe(100);
  });

  it('should return null and record a miss for non-existent key', async () => {
    const result = await service.get('non-existent-key');
    expect(result).toBeNull();

    const metrics = service.getMetrics();
    expect(metrics.misses).toBe(1);
  });

  it('should delete keys properly', async () => {
    await service.set('key-to-delete', 'some-value');
    await service.del('key-to-delete');

    const result = await service.get('key-to-delete');
    expect(result).toBeNull();
  });

  it('should expire keys when ttl is reached', async () => {
    await service.set('temp-key', 'expires-soon', -1); // already expired
    const result = await service.get('temp-key');
    expect(result).toBeNull();
  });
});
