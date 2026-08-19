import { TokenInfo, TokenPair } from '@solana-arbitrage/domain';
import { PrismaClient } from '@solana-arbitrage/database';
import { Logger } from 'pino';

export class TokenAndPoolRegistry {
  private readonly prisma: PrismaClient;
  private readonly logger: Logger | undefined;
  private whitelistedTokens: TokenInfo[] = [];

  constructor(prisma: PrismaClient, logger?: Logger) {
    this.prisma = prisma;
    this.logger = logger;
  }

  public async refreshRegistry(): Promise<void> {
    try {
      const tokens = await this.prisma.token.findMany({
        where: { enabled: true, whitelisted: true },
      });

      this.whitelistedTokens = tokens.map((t) => ({
        id: t.id,
        mintAddress: t.mintAddress,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        enabled: t.enabled,
        whitelisted: t.whitelisted,
      }));

      this.logger?.info(
        { count: this.whitelistedTokens.length },
        'Token registry refreshed with whitelisted tokens'
      );
    } catch (err: unknown) {
      this.logger?.error({ err }, 'Failed to refresh token registry');
    }
  }

  public getWhitelistedTokens(): TokenInfo[] {
    return [...this.whitelistedTokens];
  }

  public getTradingPairs(): TokenPair[] {
    const sol = this.whitelistedTokens.find((t) => t.symbol === 'SOL');
    const usdc = this.whitelistedTokens.find((t) => t.symbol === 'USDC');
    const usdt = this.whitelistedTokens.find((t) => t.symbol === 'USDT');

    const pairs: TokenPair[] = [];
    if (sol && usdc) {
      pairs.push({ baseToken: sol, quoteToken: usdc });
    }
    if (sol && usdt) {
      pairs.push({ baseToken: sol, quoteToken: usdt });
    }
    return pairs;
  }
}
