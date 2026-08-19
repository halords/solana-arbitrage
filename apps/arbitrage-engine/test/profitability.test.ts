import { describe, it, expect } from 'vitest';
import { ProfitabilityEngine } from '../src/profitability.js';
import { Quote, TokenInfo } from '@solana-arbitrage/domain';
import Decimal from 'decimal.js';

describe('ProfitabilityEngine', () => {
  const engine = new ProfitabilityEngine();

  const solToken: TokenInfo = {
    id: 'sol',
    mintAddress: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'SOL',
    decimals: 9,
    enabled: true,
    whitelisted: true,
  };

  const usdcToken: TokenInfo = {
    id: 'usdc',
    mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USDC',
    decimals: 6,
    enabled: true,
    whitelisted: true,
  };

  const buyQuote: Quote = {
    poolId: 'raydium-pool',
    dexId: 'raydium',
    tokenIn: solToken,
    tokenOut: usdcToken,
    inputAmount: BigInt(1000000000),
    expectedOutputAmount: BigInt(180000000),
    price: new Decimal('180.00'), // Buy at $180.00
    feeAmount: BigInt(450000),
    priceImpactPercent: new Decimal('0.0005'),
    estimatedSlippagePercent: new Decimal('0.0010'),
    slot: BigInt(100),
    timestamp: new Date(),
  };

  const sellQuote: Quote = {
    poolId: 'orca-pool',
    dexId: 'orca',
    tokenIn: solToken,
    tokenOut: usdcToken,
    inputAmount: BigInt(1000000000),
    expectedOutputAmount: BigInt(183000000),
    price: new Decimal('183.00'), // Sell at $183.00 ($3.00 spread per SOL ~ 1.66%)
    feeAmount: BigInt(540000),
    priceImpactPercent: new Decimal('0.0005'),
    estimatedSlippagePercent: new Decimal('0.0010'),
    slot: BigInt(100),
    timestamp: new Date(),
  };

  it('should compute positive net profit when spread outweighs fees and slippage', () => {
    const result = engine.calculateProfitability({
      buyQuote,
      sellQuote,
      tradeAmountUsd: new Decimal(100),
    });

    expect(result.grossProfitUsd.toFixed(4)).toBe('1.6667');
    expect(result.netProfitUsd.greaterThan(0)).toBe(true);
    expect(result.isProfitable).toBe(true);
  });

  it('should find optimal trade size across predefined tiers', () => {
    const optimal = engine.optimizeTradeSize(buyQuote, sellQuote, [10, 25, 50, 100]);
    expect(optimal).not.toBeNull();
    expect(optimal?.tradeAmountUsd.toNumber()).toBe(100);
  });
});
