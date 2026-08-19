import { describe, it, expect } from 'vitest';
import { RiskEngine } from '../src/risk.js';
import { loadConfig } from '@solana-arbitrage/config';
import { Quote, TokenInfo } from '@solana-arbitrage/domain';
import { ProfitabilityCalculationResult } from '../src/profitability.js';
import Decimal from 'decimal.js';

describe('RiskEngine', () => {
  const config = loadConfig({
    MAX_TRADE_USD: '100',
    MIN_PROFIT_USD: '0.05',
    MIN_ROI_PERCENT: '0.10',
    MAX_SLIPPAGE_PERCENT: '0.30',
    MAX_QUOTE_AGE_MS: '1000',
  });

  const riskEngine = new RiskEngine(config);

  const dummyToken: TokenInfo = {
    id: '1',
    mintAddress: 'mint',
    symbol: 'SOL',
    name: 'SOL',
    decimals: 9,
    enabled: true,
    whitelisted: true,
  };

  const validQuote: Quote = {
    poolId: 'p1',
    dexId: 'raydium',
    tokenIn: dummyToken,
    tokenOut: dummyToken,
    inputAmount: BigInt(1),
    expectedOutputAmount: BigInt(1),
    price: new Decimal(100),
    feeAmount: BigInt(0),
    priceImpactPercent: new Decimal('0.0005'),
    estimatedSlippagePercent: new Decimal('0.001'),
    slot: BigInt(1),
    timestamp: new Date(),
  };

  it('should allow valid trade within risk thresholds', () => {
    const calc: ProfitabilityCalculationResult = {
      tradeAmountUsd: new Decimal(50),
      grossProfitUsd: new Decimal('0.50'),
      dexFeesUsd: new Decimal('0.10'),
      networkFeesUsd: new Decimal('0.001'),
      priorityFeesUsd: new Decimal('0.002'),
      slippageCostUsd: new Decimal('0.05'),
      priceImpactUsd: new Decimal('0.01'),
      safetyBufferUsd: new Decimal('0.01'),
      netProfitUsd: new Decimal('0.327'),
      roiPercent: new Decimal('0.654'),
      isProfitable: true,
    };

    const result = riskEngine.evaluateOpportunity(calc, validQuote, validQuote);
    expect(result.isAllowed).toBe(true);
  });

  it('should reject trade exceeding MAX_TRADE_USD', () => {
    const calc: ProfitabilityCalculationResult = {
      tradeAmountUsd: new Decimal(200), // Exceeds $100
      grossProfitUsd: new Decimal('1.00'),
      dexFeesUsd: new Decimal('0.10'),
      networkFeesUsd: new Decimal('0.001'),
      priorityFeesUsd: new Decimal('0.002'),
      slippageCostUsd: new Decimal('0.05'),
      priceImpactUsd: new Decimal('0.01'),
      safetyBufferUsd: new Decimal('0.01'),
      netProfitUsd: new Decimal('0.827'),
      roiPercent: new Decimal('0.4135'),
      isProfitable: true,
    };

    const result = riskEngine.evaluateOpportunity(calc, validQuote, validQuote);
    expect(result.isAllowed).toBe(false);
    expect(result.ruleName).toBe('MAX_TRADE_USD');
  });

  it('should reject trade below MIN_PROFIT_USD', () => {
    const calc: ProfitabilityCalculationResult = {
      tradeAmountUsd: new Decimal(50),
      grossProfitUsd: new Decimal('0.10'),
      dexFeesUsd: new Decimal('0.05'),
      networkFeesUsd: new Decimal('0.001'),
      priorityFeesUsd: new Decimal('0.002'),
      slippageCostUsd: new Decimal('0.02'),
      priceImpactUsd: new Decimal('0.01'),
      safetyBufferUsd: new Decimal('0.01'),
      netProfitUsd: new Decimal('0.007'), // Below $0.05 threshold
      roiPercent: new Decimal('0.014'),
      isProfitable: true,
    };

    const result = riskEngine.evaluateOpportunity(calc, validQuote, validQuote);
    expect(result.isAllowed).toBe(false);
    expect(result.ruleName).toBe('MIN_PROFIT_USD');
  });
});
