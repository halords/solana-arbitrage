import { DexAdapter, LiquidityDepth, QuoteRequest } from './adapter.js';
import { TokenPair, PoolState, Quote } from '@solana-arbitrage/domain';
import { AppConfig } from '@solana-arbitrage/config';
import { Logger } from 'pino';
import Decimal from 'decimal.js';
import { Rpc, SolanaRpcApi, Address } from '@solana/kit';

export class RaydiumAdapter implements DexAdapter {
  public readonly id = 'raydium';
  public readonly name = 'Raydium';
  public readonly enabled: boolean;

  protected readonly _logger: Logger | undefined;
  private readonly defaultFeePercent = new Decimal('0.0025'); // 0.25% standard AMM fee
  private rpc: Rpc<SolanaRpcApi> | null = null;

  // Raydium V4 AMM pool account layout offsets for reserve balances
  private static readonly RESERVE_A_OFFSET = 208; // tokenA reserve (u64, 8 bytes)
  private static readonly RESERVE_B_OFFSET = 216; // tokenB reserve (u64, 8 bytes)

  constructor(config: AppConfig, logger?: Logger) {
    this.enabled = config.RAYDIUM_ENABLED;
    this._logger = logger;
  }

  /**
   * Attach a live RPC connection for on-chain reads
   */
  public setRpc(rpc: Rpc<SolanaRpcApi>): void {
    this.rpc = rpc;
  }

  private lastCachedReserves: { reserveA: bigint; reserveB: bigint; price: Decimal; timestamp: number } | null = null;
  private static readonly CACHE_TTL_MS = 2000;

  /**
   * Read live on-chain pool reserves from a Raydium AMM pool account (with 2s local caching)
   */
  public async readOnChainReserves(
    poolAddress: Address
  ): Promise<{ reserveA: bigint; reserveB: bigint; price: Decimal } | null> {
    if (this.lastCachedReserves && Date.now() - this.lastCachedReserves.timestamp < RaydiumAdapter.CACHE_TTL_MS) {
      return this.lastCachedReserves;
    }

    if (!this.rpc) {
      return this.lastCachedReserves;
    }

    try {
      const accountInfo = await this.rpc.getAccountInfo(poolAddress, { encoding: 'base64' }).send();
      if (!accountInfo.value || !accountInfo.value.data) {
        this._logger?.warn({ poolAddress }, 'Pool account not found on-chain');
        return null;
      }

      const data = accountInfo.value.data;
      let buffer: Buffer;
      if (Array.isArray(data)) {
        buffer = Buffer.from(data[0] as string, 'base64');
      } else {
        return null;
      }

      if (buffer.length < RaydiumAdapter.RESERVE_B_OFFSET + 8) {
        this._logger?.warn({ poolAddress, bufferLen: buffer.length }, 'Pool account data too short');
        return null;
      }

      const reserveA = buffer.readBigUInt64LE(RaydiumAdapter.RESERVE_A_OFFSET);
      const reserveB = buffer.readBigUInt64LE(RaydiumAdapter.RESERVE_B_OFFSET);

      // Price = reserveB (USDC, 6 decimals) / reserveA (SOL, 9 decimals)
      // Adjust for decimal difference: multiply by 10^3
      const price = new Decimal(reserveB.toString())
        .div(new Decimal(reserveA.toString()))
        .mul(new Decimal('1000')); // 10^(9-6) = 10^3

      this._logger?.debug(
        {
          poolAddress,
          reserveA: reserveA.toString(),
          reserveB: reserveB.toString(),
          price: price.toFixed(4),
        },
        'Read Raydium on-chain reserves'
      );

      const res = { reserveA, reserveB, price, timestamp: Date.now() };
      this.lastCachedReserves = res;
      return res;
    } catch {
      // Fallback gracefully to last cached data if RPC is throttled
      return this.lastCachedReserves;
    }
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

  /**
   * Get a quote using live on-chain reserves if RPC is available,
   * otherwise fall back to simulated benchmark price.
   */
  public async getQuote(request: QuoteRequest): Promise<Quote> {
    // Try live on-chain price first
    const raydiumPoolAddress = '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2' as Address;
    const onChainData = await this.readOnChainReserves(raydiumPoolAddress);

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
      this._logger?.debug({ price: price.toFixed(4), source: 'on-chain' }, 'Using live Raydium price');
    } else {
      // Fallback to simulated benchmark price
      const benchmarkPrice = new Decimal('178.00');
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
