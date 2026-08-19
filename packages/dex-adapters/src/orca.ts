import { DexAdapter, LiquidityDepth, QuoteRequest } from './adapter.js';
import { TokenPair, PoolState, Quote } from '@solana-arbitrage/domain';
import { AppConfig } from '@solana-arbitrage/config';
import { Logger } from 'pino';
import Decimal from 'decimal.js';
import { Rpc, SolanaRpcApi, Address } from '@solana/kit';

export class OrcaAdapter implements DexAdapter {
  public readonly id = 'orca';
  public readonly name = 'Orca';
  public readonly enabled: boolean;

  protected readonly _logger: Logger | undefined;
  private readonly defaultFeePercent = new Decimal('0.0030'); // 0.30% standard Whirlpool fee tier
  private rpc: Rpc<SolanaRpcApi> | null = null;

  // Orca Whirlpool account layout offsets
  // sqrtPrice (u128, 16 bytes) at offset 65
  private static readonly SQRT_PRICE_OFFSET = 65;

  constructor(config: AppConfig, logger?: Logger) {
    this.enabled = config.ORCA_ENABLED;
    this._logger = logger;
  }

  /**
   * Attach a live RPC connection for on-chain reads
   */
  public setRpc(rpc: Rpc<SolanaRpcApi>): void {
    this.rpc = rpc;
  }

  private lastCachedPrice: { price: Decimal; timestamp: number } | null = null;
  private static readonly CACHE_TTL_MS = 2000;

  /**
   * Read live on-chain Whirlpool sqrtPrice to derive current price (with 2s local caching)
   */
  public async readOnChainPrice(
    poolAddress: Address
  ): Promise<{ price: Decimal } | null> {
    if (this.lastCachedPrice && Date.now() - this.lastCachedPrice.timestamp < OrcaAdapter.CACHE_TTL_MS) {
      return this.lastCachedPrice;
    }

    if (!this.rpc) {
      return this.lastCachedPrice;
    }

    try {
      const accountInfo = await this.rpc.getAccountInfo(poolAddress, { encoding: 'base64' }).send();
      if (!accountInfo.value || !accountInfo.value.data) {
        this._logger?.warn({ poolAddress }, 'Whirlpool account not found on-chain');
        return null;
      }

      const data = accountInfo.value.data;
      let buffer: Buffer;
      if (Array.isArray(data)) {
        buffer = Buffer.from(data[0] as string, 'base64');
      } else {
        return null;
      }

      if (buffer.length < OrcaAdapter.SQRT_PRICE_OFFSET + 16) {
        this._logger?.warn({ poolAddress, bufferLen: buffer.length }, 'Whirlpool account data too short');
        return null;
      }

      // Read sqrtPrice as u128 (little-endian, 16 bytes)
      const lo = buffer.readBigUInt64LE(OrcaAdapter.SQRT_PRICE_OFFSET);
      const hi = buffer.readBigUInt64LE(OrcaAdapter.SQRT_PRICE_OFFSET + 8);
      const sqrtPriceX64 = (hi << BigInt(64)) | lo;

      // Orca SOL/USDC Whirlpool: TokenA=USDC (6 decimals), TokenB=SOL (9 decimals)
      // raw_price = (sqrtPriceX64 / 2^64)^2 (in SOL per USDC)
      // Price in USDC per SOL = 1 / (raw_price * 10^(9 - 6)) = 1 / (raw_price * 1000)
      const sqrtPriceDecimal = new Decimal(sqrtPriceX64.toString()).div(
        new Decimal(2).pow(64)
      );
      const rawPrice = sqrtPriceDecimal.pow(2);
      // Derive real-time SOL price in USD:
      const price = new Decimal(1).div(rawPrice.mul(new Decimal('0.001')));

      this._logger?.debug(
        { poolAddress, price: price.toFixed(4) },
        'Read Orca Whirlpool on-chain price'
      );

      const res = { price, timestamp: Date.now() };
      this.lastCachedPrice = res;
      return res;
    } catch {
      // Fallback gracefully to last cached data if RPC is throttled
      return this.lastCachedPrice;
    }
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

  /**
   * Get a quote using live on-chain sqrtPrice if RPC is available,
   * otherwise fall back to simulated benchmark price.
   */
  public async getQuote(request: QuoteRequest): Promise<Quote> {
    // Try live on-chain price first
    const orcaPoolAddress = 'HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ' as Address;
    const onChainData = await this.readOnChainPrice(orcaPoolAddress);

    const inputDecimal = new Decimal(request.amountIn.toString()).div(
      new Decimal(10).pow(request.tokenIn.decimals)
    );

    let price: Decimal;
    let outputDecimal: Decimal;

    if (onChainData) {
      // Use live on-chain price
      if (request.tokenIn.symbol === 'SOL') {
        price = onChainData.price;
        outputDecimal = inputDecimal.mul(price);
      } else {
        price = new Decimal(1).div(onChainData.price);
        outputDecimal = inputDecimal.div(onChainData.price);
      }
      this._logger?.debug({ price: price.toFixed(4), source: 'on-chain' }, 'Using live Orca price');
    } else {
      // Fallback to simulated benchmark price
      const benchmarkPrice = new Decimal('182.50');
      if (request.tokenIn.symbol === 'SOL') {
        price = benchmarkPrice;
        outputDecimal = inputDecimal.mul(price);
      } else {
        price = new Decimal(1).div(benchmarkPrice);
        outputDecimal = inputDecimal.div(benchmarkPrice);
      }
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
      priceImpactPercent: new Decimal('0.0003'),
      estimatedSlippagePercent: new Decimal('0.001'),
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
