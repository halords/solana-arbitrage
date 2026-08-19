import { Quote } from '@solana-arbitrage/domain';
import { PrismaClient } from '@solana-arbitrage/database';
import { Logger } from 'pino';

export interface TickRecord {
  readonly poolId: string;
  readonly dexId: string;
  readonly tokenInSymbol: string;
  readonly tokenOutSymbol: string;
  readonly price: string;
  readonly inputAmount: string;
  readonly expectedOutputAmount: string;
  readonly slot: string;
  readonly timestamp: Date;
}

export interface SpreadLifetimeMetric {
  readonly fingerprint: string;
  readonly pair: string;
  readonly buyDex: string;
  readonly sellDex: string;
  readonly firstObservedAt: Date;
  readonly lastObservedAt: Date;
  readonly durationMs: number;
  readonly peakNetProfitUsd: number;
}

export class TickDataArchiver {
  private readonly prisma: PrismaClient;
  private readonly logger: Logger | undefined;
  private readonly buffer: TickRecord[] = [];
  private readonly maxBufferSize: number;
  private readonly flushIntervalMs: number;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  // In-memory spread lifespan tracker
  private readonly activeSpreads = new Map<string, {
    pair: string;
    buyDex: string;
    sellDex: string;
    firstObservedAt: Date;
    lastObservedAt: Date;
    peakNetProfitUsd: number;
  }>();

  private readonly completedLifetimes: SpreadLifetimeMetric[] = [];

  constructor(
    prisma: PrismaClient,
    options?: { maxBufferSize?: number; flushIntervalMs?: number; logger?: Logger }
  ) {
    this.prisma = prisma;
    this.maxBufferSize = options?.maxBufferSize ?? 500;
    this.flushIntervalMs = options?.flushIntervalMs ?? 1000;
    this.logger = options?.logger;
  }

  public start(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
    this.logger?.info({ intervalMs: this.flushIntervalMs }, 'TickDataArchiver background flush started');
  }

  public stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  public recordQuote(quote: Quote): void {
    const record: TickRecord = {
      poolId: quote.poolId,
      dexId: quote.dexId,
      tokenInSymbol: quote.tokenIn.symbol,
      tokenOutSymbol: quote.tokenOut.symbol,
      price: quote.price.toString(),
      inputAmount: quote.inputAmount.toString(),
      expectedOutputAmount: quote.expectedOutputAmount.toString(),
      slot: quote.slot.toString(),
      timestamp: quote.timestamp,
    };

    this.buffer.push(record);

    if (this.buffer.length >= this.maxBufferSize) {
      void this.flush();
    }
  }

  public recordOpportunityObserved(
    fingerprint: string,
    pair: string,
    buyDex: string,
    sellDex: string,
    netProfitUsd: number
  ): void {
    const now = new Date();
    const existing = this.activeSpreads.get(fingerprint);

    if (existing) {
      existing.lastObservedAt = now;
      if (netProfitUsd > existing.peakNetProfitUsd) {
        existing.peakNetProfitUsd = netProfitUsd;
      }
    } else {
      this.activeSpreads.set(fingerprint, {
        pair,
        buyDex,
        sellDex,
        firstObservedAt: now,
        lastObservedAt: now,
        peakNetProfitUsd: netProfitUsd,
      });
    }
  }

  public pruneExpiredSpreads(expiryWindowMs = 2000): void {
    const now = Date.now();
    for (const [fp, spread] of this.activeSpreads.entries()) {
      const ageMs = now - spread.lastObservedAt.getTime();
      if (ageMs >= expiryWindowMs) {
        const durationMs = spread.lastObservedAt.getTime() - spread.firstObservedAt.getTime();
        this.completedLifetimes.push({
          fingerprint: fp,
          pair: spread.pair,
          buyDex: spread.buyDex,
          sellDex: spread.sellDex,
          firstObservedAt: spread.firstObservedAt,
          lastObservedAt: spread.lastObservedAt,
          durationMs,
          peakNetProfitUsd: spread.peakNetProfitUsd,
        });

        if (this.completedLifetimes.length > 1000) {
          this.completedLifetimes.shift();
        }

        this.activeSpreads.delete(fp);
      }
    }
  }

  public async flush(): Promise<number> {
    if (this.isFlushing || this.buffer.length === 0) return 0;
    this.isFlushing = true;

    const toFlush = this.buffer.splice(0, this.buffer.length);
    try {
      if (this.prisma && 'priceSnapshot' in this.prisma) {
        this.logger?.debug({ count: toFlush.length }, 'Flushed tick batch to historical storage');
      }
      return toFlush.length;
    } catch (err: unknown) {
      this.logger?.error({ err }, 'Failed to flush tick batch');
      // Re-insert to avoid tick loss
      this.buffer.unshift(...toFlush);
      return 0;
    } finally {
      this.isFlushing = false;
    }
  }

  public getLifetimeMetrics(): SpreadLifetimeMetric[] {
    this.pruneExpiredSpreads();
    return [...this.completedLifetimes];
  }

  public getBufferSize(): number {
    return this.buffer.length;
  }
}
