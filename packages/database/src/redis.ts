import Redis from 'ioredis';
import { AppConfig } from '@solana-arbitrage/config';
import { Logger } from 'pino';

export interface RedisHealthStatus {
  readonly isHealthy: boolean;
  readonly latencyMs: number;
  readonly lastCheckedAt: Date;
  readonly error?: string;
}

export interface CachedMarketPrice {
  readonly poolId: string;
  readonly dexId: string;
  readonly price: string;
  readonly slot: string;
  readonly updatedAt: number;
}

export class RedisRepository {
  private readonly client: Redis;
  private readonly logger: Logger | undefined;

  constructor(config: AppConfig, logger?: Logger) {
    this.logger = logger;
    this.client = new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number): number | null => {
        if (times > 5) {
          return null;
        }
        return Math.min(times * 200, 1000);
      },
    });

    this.client.on('error', (err: Error) => {
      this.logger?.error({ err }, 'Redis connection error');
    });
  }

  public async connect(): Promise<void> {
    if (this.client.status !== 'ready' && this.client.status !== 'connecting') {
      await this.client.connect();
    }
  }

  public async checkHealth(): Promise<RedisHealthStatus> {
    const startTime = Date.now();
    try {
      await this.client.ping();
      return {
        isHealthy: true,
        latencyMs: Date.now() - startTime,
        lastCheckedAt: new Date(),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isHealthy: false,
        latencyMs: Date.now() - startTime,
        lastCheckedAt: new Date(),
        error: message,
      };
    }
  }

  public async setMarketPrice(
    poolId: string,
    data: CachedMarketPrice,
    ttlSeconds = 60
  ): Promise<void> {
    const key = `market:price:${poolId}`;
    await this.client.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  }

  public async getMarketPrice(poolId: string): Promise<CachedMarketPrice | null> {
    const key = `market:price:${poolId}`;
    const raw = await this.client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedMarketPrice;
  }

  public async lockOpportunityFingerprint(
    fingerprint: string,
    ttlMs: number
  ): Promise<boolean> {
    const key = `lock:opp:${fingerprint}`;
    const acquired = await this.client.set(key, '1', 'PX', ttlMs, 'NX');
    return acquired === 'OK';
  }

  public async disconnect(): Promise<void> {
    await this.client.quit();
  }

  public getRawClient(): Redis {
    return this.client;
  }
}
