import Decimal from 'decimal.js';

export type DexId = 'raydium' | 'orca' | string;
export type OpportunityStatus =
  | 'DETECTED'
  | 'REJECTED'
  | 'SIMULATED'
  | 'PAPER_TRADED'
  | 'EXPIRED'
  | 'EXECUTED'
  | 'FAILED';

export type TradingMode = 'paper' | 'live';

export interface TokenInfo {
  readonly id: string;
  readonly mintAddress: string;
  readonly symbol: string;
  readonly name: string;
  readonly decimals: number;
  readonly enabled: boolean;
  readonly whitelisted: boolean;
}

export interface TokenPair {
  readonly baseToken: TokenInfo;
  readonly quoteToken: TokenInfo;
}

export interface PoolState {
  readonly id: string;
  readonly dexId: DexId;
  readonly externalPoolId: string;
  readonly tokenA: TokenInfo;
  readonly tokenB: TokenInfo;
  readonly poolType: 'AMM' | 'CLMM' | 'CPMM' | string;
  readonly liquidityUsd: Decimal;
  readonly lastUpdatedAt: Date;
}

export interface Quote {
  readonly poolId: string;
  readonly dexId: DexId;
  readonly tokenIn: TokenInfo;
  readonly tokenOut: TokenInfo;
  readonly inputAmount: bigint;
  readonly expectedOutputAmount: bigint;
  readonly price: Decimal;
  readonly feeAmount: bigint;
  readonly priceImpactPercent: Decimal;
  readonly estimatedSlippagePercent: Decimal;
  readonly slot: bigint;
  readonly timestamp: Date;
}

export interface ArbitrageOpportunity {
  readonly id: string;
  readonly fingerprint: string;
  readonly tokenPair: TokenPair;
  readonly buyDexId: DexId;
  readonly sellDexId: DexId;
  readonly tradeAmountUsd: Decimal;
  readonly grossProfitUsd: Decimal;
  readonly dexFeesUsd: Decimal;
  readonly networkFeesUsd: Decimal;
  readonly priorityFeesUsd: Decimal;
  readonly slippageCostUsd: Decimal;
  readonly priceImpactUsd: Decimal;
  readonly safetyBufferUsd: Decimal;
  readonly netProfitUsd: Decimal;
  readonly roiPercent: Decimal;
  readonly status: OpportunityStatus;
  readonly detectedAt: Date;
  readonly expiresAt: Date;
}

export interface RiskEvaluationResult {
  readonly isAllowed: boolean;
  readonly violationReason?: string;
  readonly ruleName?: string;
  readonly threshold?: Decimal;
  readonly actualValue?: Decimal;
}

export interface PaperTradeRecord {
  readonly id: string;
  readonly opportunityId: string;
  readonly mode: 'PAPER';
  readonly inputAmountUsd: Decimal;
  readonly expectedOutputUsd: Decimal;
  readonly actualOutputUsd: Decimal;
  readonly expectedProfitUsd: Decimal;
  readonly actualProfitUsd: Decimal;
  readonly status: 'COMPLETED' | 'FAILED';
  readonly createdAt: Date;
}
