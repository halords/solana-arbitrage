import { DexAdapter, LiquidityDepth, QuoteRequest } from './adapter.js';
import { TokenPair, PoolState, Quote } from '@solana-arbitrage/domain';
import { AppConfig } from '@solana-arbitrage/config';
import { Logger } from 'pino';
import Decimal from 'decimal.js';

export class RaydiumAdapter implements DexAdapter {
  public readonly id = 'raydium';
  public readonly name = 'Raydium';
  public readonly enabled: boolean;

  protected readonly _logger: Logger | undefined;
  private readonly defaultFeePercent = new Decimal('0.0025'); // 0.25% standard AMM fee

  constructor(config: AppConfig, logger?: Logger) {
    this.enabled = config.RAYDIUM_ENABLED;
    this._logger = logger;
  }

  public async getMarkets(): Promise<TokenPair[]> {
    return [];
  }

  public async getPools(pair: TokenPair): Promise<PoolState[]> {
    return [
      {
        id: `raydium-${pair.baseToken.symbol}-${pair.quoteToken.symbol}`,
        dexId: this.id,
        externalPoolId: `pool-raydium-${pair.baseToken.symbol}-${pair.quoteToken.symbol}`,
        tokenA: pair.baseToken,
        tokenB: pair.quoteToken,
        poolType: 'AMM',
        liquidityUsd: new Decimal('2500000'),
        lastUpdatedAt: new Date(),
      },
    ];
  }

  public async getQuote(request: QuoteRequest): Promise<Quote> {
    const inputDecimal = new Decimal(request.amountIn.toString()).div(
      new Decimal(10).pow(request.tokenIn.decimals)
    );

    // Simulated benchmark pool state: 1 SOL = 178.00 USDC
    const benchmarkPrice = new Decimal('178.00');
    let outputDecimal: Decimal;
    let price: Decimal;

    if (request.tokenIn.symbol === 'SOL') {
      price = benchmarkPrice;
      outputDecimal = inputDecimal.mul(price);
    } else {
      price = new Decimal(1).div(benchmarkPrice);
      outputDecimal = inputDecimal.div(benchmarkPrice);
    }

    const feeAmountDecimal = outputDecimal.mul(this.defaultFeePercent);
    const netOutputDecimal = outputDecimal.sub(feeAmountDecimal);

    const expectedOutputAmount = BigInt(
      netOutputDecimal.mul(new Decimal(10).pow(request.tokenOut.decimals)).toFixed(0, Decimal.ROUND_DOWN)
    );

    const feeAmountBigInt = BigInt(
      feeAmountDecimal.mul(new Decimal(10).pow(request.tokenOut.decimals)).toFixed(0, Decimal.ROUND_DOWN)
    );

    return {
      poolId: request.poolId,
      dexId: this.id,
      tokenIn: request.tokenIn,
      tokenOut: request.tokenOut,
      inputAmount: request.amountIn,
      expectedOutputAmount,
      price,
      feeAmount: feeAmountBigInt,
      priceImpactPercent: new Decimal('0.0005'), // 0.05%
      estimatedSlippagePercent: new Decimal('0.001'), // 0.1%
      slot: BigInt(250000100),
      timestamp: new Date(),
    };
  }

  public async getLiquidity(poolId: string): Promise<LiquidityDepth> {
    return {
      poolId,
      tokenAReserve: BigInt('10000000000000'),
      tokenBReserve: BigInt('1802000000000'),
      totalLiquidityUsd: new Decimal('3604000'),
      slot: BigInt(250000100),
    };
  }
}
