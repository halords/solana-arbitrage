import { TokenPair, PoolState, Quote, TokenInfo } from '@solana-arbitrage/domain';
import Decimal from 'decimal.js';

export interface QuoteRequest {
  readonly poolId: string;
  readonly tokenIn: TokenInfo;
  readonly tokenOut: TokenInfo;
  readonly amountIn: bigint;
  readonly slippageTolerancePercent?: Decimal;
}

export interface LiquidityDepth {
  readonly poolId: string;
  readonly tokenAReserve: bigint;
  readonly tokenBReserve: bigint;
  readonly totalLiquidityUsd: Decimal;
  readonly slot: bigint;
}

export interface DexAdapter {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;

  getMarkets(): Promise<TokenPair[]>;
  getPools(pair: TokenPair): Promise<PoolState[]>;
  getQuote(request: QuoteRequest): Promise<Quote>;
  getLiquidity(poolId: string): Promise<LiquidityDepth>;
}
