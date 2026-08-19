import { DexAdapter, LiquidityDepth, QuoteRequest } from './adapter.js';
import { TokenPair, PoolState, Quote } from '@solana-arbitrage/domain';
import { AppConfig } from '@solana-arbitrage/config';
import { Logger } from 'pino';
import Decimal from 'decimal.js';

export class OrcaAdapter implements DexAdapter {
  public readonly id = 'orca';
  public readonly name = 'Orca';
  public readonly enabled: boolean;

  protected readonly _logger: Logger | undefined;
  private readonly defaultFeePercent = new Decimal('0.0030'); // 0.30% standard Whirlpool fee tier

  constructor(config: AppConfig, logger?: Logger) {
    this.enabled = config.ORCA_ENABLED;
    this._logger = logger;
  }

  public async getMarkets(): Promise<TokenPair[]> {
    return [];
  }

  public async getPools(pair: TokenPair): Promise<PoolState[]> {
    return [
      {
        id: `orca-${pair.baseToken.symbol}-${pair.quoteToken.symbol}`,
        dexId: this.id,
        externalPoolId: `pool-orca-${pair.baseToken.symbol}-${pair.quoteToken.symbol}`,
        tokenA: pair.baseToken,
        tokenB: pair.quoteToken,
        poolType: 'CLMM',
        liquidityUsd: new Decimal('4200000'),
        lastUpdatedAt: new Date(),
      },
    ];
  }

  public async getQuote(request: QuoteRequest): Promise<Quote> {
    const inputDecimal = new Decimal(request.amountIn.toString()).div(
      new Decimal(10).pow(request.tokenIn.decimals)
    );

    // Simulated benchmark pool state: 1 SOL = 182.50 USDC (creating spread against Raydium $180.20)
    const benchmarkPrice = new Decimal('182.50');
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
      priceImpactPercent: new Decimal('0.0003'), // 0.03%
      estimatedSlippagePercent: new Decimal('0.001'), // 0.1%
      slot: BigInt(250000100),
      timestamp: new Date(),
    };
  }

  public async getLiquidity(poolId: string): Promise<LiquidityDepth> {
    return {
      poolId,
      tokenAReserve: BigInt('15000000000000'),
      tokenBReserve: BigInt('2705250000000'),
      totalLiquidityUsd: new Decimal('5410500'),
      slot: BigInt(250000100),
    };
  }
}
