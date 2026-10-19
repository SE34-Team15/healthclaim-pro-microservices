import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly inMemoryFallback = new Map<string, { value: string; expiresAt?: number }>();
  private isConnected = false;
  private hits = 0;
  private misses = 0;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 2000,
        retryStrategy: () => null, // Do not infinite retry if unavailable during tests
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Connected to Redis instance at ${redisUrl}`);
      });

      this.client.on('error', (err) => {
        if (this.isConnected) {
          this.logger.warn(`Redis error: ${err.message}. Engaging memory fallback.`);
        }
        this.isConnected = false;
      });
    } catch (err: any) {
      this.logger.warn(`Failed to initialize Redis client (${err.message}). In-memory cache fallback active.`);
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // ignore
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.isConnected && this.client) {
      try {
        const raw = await this.client.get(key);
        if (raw !== null) {
          this.hits++;
          return JSON.parse(raw) as T;
        }
        this.misses++;
        return null;
      } catch (err: any) {
        this.logger.warn(`Redis get failed for key "${key}": ${err.message}. Using fallback.`);
      }
    }

    // In-memory fallback
    const entry = this.inMemoryFallback.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.inMemoryFallback.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return JSON.parse(entry.value) as T;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (this.isConnected && this.client) {
      try {
        if (ttlSeconds && ttlSeconds > 0) {
          await this.client.set(key, serialized, 'EX', ttlSeconds);
        } else {
          await this.client.set(key, serialized);
        }
        return;
      } catch (err: any) {
        this.logger.warn(`Redis set failed for key "${key}": ${err.message}. Using fallback.`);
      }
    }

    // In-memory fallback
    const expiresAt = ttlSeconds !== undefined ? Date.now() + ttlSeconds * 1000 : undefined;
    this.inMemoryFallback.set(key, { value: serialized, expiresAt });
  }

  async del(key: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
      } catch (err: any) {
        this.logger.warn(`Redis del failed for key "${key}": ${err.message}.`);
      }
    }
    this.inMemoryFallback.delete(key);
  }

  getMetrics() {
    const total = this.hits + this.misses;
    const hitRatio = total > 0 ? (this.hits / total) * 100 : 0;
    return {
      connected: this.isConnected,
      hits: this.hits,
      misses: this.misses,
      totalRequests: total,
      hitRatio: Number(hitRatio.toFixed(2)),
    };
  }

  resetMetrics() {
    this.hits = 0;
    this.misses = 0;
  }
}
