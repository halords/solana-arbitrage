import { describe, it, expect } from 'vitest';
import { TriangularRouteOptimizer, RouteLeg } from '../src/triangular.js';
import { Quote, TokenInfo } from '@solana-arbitrage/domain';
import Decimal from 'decimal.js';

describe('TriangularRouteOptimizer', () => {
  const optimizer = new TriangularRouteOptimizer();

  const solToken: TokenInfo = {
    id: 'sol-id',
    mintAddress: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'SOL',
    decimals: 9,
    enabled: true,
    whitelisted: true,
  };

  const usdcToken: TokenInfo = {
    id: 'usdc-id',
    mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USDC',
    decimals: 6,
    enabled: true,
    whitelisted: true,
  };

  const usdtToken: TokenInfo = {
    id: 'usdt-id',
    mintAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'USDT',
    decimals: 6,
    enabled: true,
    whitelisted: true,
  };

  const createDummyQuote = (price: string): Quote => ({
    poolId: 'dummy-pool',
    dexId: 'dummy-dex',
    tokenIn: solToken,
    tokenOut: usdcToken,
    inputAmount: BigInt(1000000000),
    expectedOutputAmount: BigInt(1000000000),
    price: new Decimal(price),
    feeAmount: BigInt(250000),
    priceImpactPercent: new Decimal('0.0001'),
    estimatedSlippagePercent: new Decimal('0.0005'),
    slot: BigInt(100),
    timestamp: new Date(),
  });

  it('should reject invalid non-closed routes', () => {
    const leg1: RouteLeg = {
      dexId: 'raydium',
      tokenIn: solToken,
      tokenOut: usdcToken,
      quote: createDummyQuote('1.0'),
      feePercent: new Decimal('0.0025'),
    };
    const leg2: RouteLeg = {
      dexId: 'orca',
      tokenIn: usdtToken, // Invalid break in chain (expected USDC)
      tokenOut: solToken,
      quote: createDummyQuote('1.0'),
      feePercent: new Decimal('0.0030'),
    };
    const leg3: RouteLeg = {
      dexId: 'raydium',
      tokenIn: solToken,
      tokenOut: solToken,
      quote: createDummyQuote('1.0'),
      feePercent: new Decimal('0.0025'),
    };

    const result = optimizer.evaluateTriangularRoute(leg1, leg2, leg3, new Decimal(10));
    expect(result).toBeNull();
  });

  it('should evaluate profitable 3-hop cyclic route (SOL -> USDC -> USDT -> SOL)', () => {
    // Leg 1: 1 SOL -> 180 USDC (rate: 180)
    const leg1: RouteLeg = {
      dexId: 'raydium',
      tokenIn: solToken,
      tokenOut: usdcToken,
      quote: createDummyQuote('180.0'),
      feePercent: new Decimal('0.0025'),
    };

    // Leg 2: 1 USDC -> 1.015 USDT (rate: 1.015)
    const leg2: RouteLeg = {
      dexId: 'orca',
      tokenIn: usdcToken,
      tokenOut: usdtToken,
      quote: createDummyQuote('1.015'),
      feePercent: new Decimal('0.0020'),
    };

    // Leg 3: 1 USDT -> 0.0056 SOL (rate: 0.0056)
    const leg3: RouteLeg = {
      dexId: 'raydium',
      tokenIn: usdtToken,
      tokenOut: solToken,
      quote: createDummyQuote('0.0056'),
      feePercent: new Decimal('0.0025'),
    };

    const result = optimizer.evaluateTriangularRoute(leg1, leg2, leg3, new Decimal(10));
    expect(result).not.toBeNull();
    expect(result?.legs.length).toBe(3);
    expect(result?.netProfitUsd).toBeDefined();
  });
});
