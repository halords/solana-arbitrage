import { DexAdapterRegistry } from '@solana-arbitrage/dex-adapters';
import { RedisRepository, PrismaClient } from '@solana-arbitrage/database';
import { TokenAndPoolRegistry } from './registry.js';
import { Quote } from '@solana-arbitrage/domain';
import { Logger } from 'pino';

export class MarketDataPoller {
  private readonly adapterRegistry: DexAdapterRegistry;
  private readonly tokenRegistry: TokenAndPoolRegistry;
  private readonly redis: RedisRepository;
  protected readonly _prisma: PrismaClient;
  private readonly logger: Logger | undefined;
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    adapterRegistry: DexAdapterRegistry,
    tokenRegistry: TokenAndPoolRegistry,
    redis: RedisRepository,
    prisma: PrismaClient,
    logger?: Logger
  ) {
    this.adapterRegistry = adapterRegistry;
    this.tokenRegistry = tokenRegistry;
    this.redis = redis;
    this._prisma = prisma;
    this.logger = logger;
  }

  public async pollOnce(): Promise<Quote[]> {
    const pairs = this.tokenRegistry.getTradingPairs();
    const adapters = this.adapterRegistry.getEnabledAdapters();
    const collectedQuotes: Quote[] = [];

    for (const pair of pairs) {
      for (const adapter of adapters) {
        try {
          const pools = await adapter.getPools(pair);
          for (const pool of pools) {
            const amountIn = BigInt(10) ** BigInt(pair.baseToken.decimals); // 1 base unit
            const quote = await adapter.getQuote({
              poolId: pool.id,
              tokenIn: pair.baseToken,
              tokenOut: pair.quoteToken,
              amountIn,
            });

            collectedQuotes.push(quote);

            // Update Redis fast-changing state cache
            await this.redis.setMarketPrice(
              pool.id,
              {
                poolId: pool.id,
                dexId: adapter.id,
                price: quote.price.toString(),
                slot: quote.slot.toString(),
                updatedAt: Date.now(),
              },
              60
            );
          }
        } catch (err: unknown) {
          this.logger?.warn(
            { dex: adapter.id, pair: `${pair.baseToken.symbol}/${pair.quoteToken.symbol}`, err },
            'Failed to retrieve quote for DEX adapter'
          );
        }
      }
    }

    return collectedQuotes;
  }

  public start(intervalMs = 250): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger?.info({ intervalMs }, 'Started market data poller');

    const loop = async (): Promise<void> => {
      if (!this.isRunning) return;
      await this.pollOnce();
      if (this.isRunning) {
        this.timer = setTimeout(loop, intervalMs);
      }
    };

    void loop();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.logger?.info('Stopped market data poller');
  }
}
