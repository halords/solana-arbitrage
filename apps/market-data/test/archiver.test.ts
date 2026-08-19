import { describe, it, expect } from 'vitest';
import { TickDataArchiver } from '../src/archiver.js';
import { Quote, TokenInfo } from '@solana-arbitrage/domain';
import { PrismaClient } from '@solana-arbitrage/database';
import Decimal from 'decimal.js';

describe('TickDataArchiver', () => {
  const mockPrisma = {} as unknown as PrismaClient;
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

  const sampleQuote: Quote = {
    poolId: 'raydium-sol-usdc',
    dexId: 'raydium',
    tokenIn: solToken,
    tokenOut: usdcToken,
    inputAmount: BigInt(1000000000),
    expectedOutputAmount: BigInt(180000000),
    price: new Decimal('180.00'),
    feeAmount: BigInt(450000),
    priceImpactPercent: new Decimal('0.0005'),
    estimatedSlippagePercent: new Decimal('0.0010'),
    slot: BigInt(250000000),
    timestamp: new Date(),
  };

  it('should buffer quotes and flush asynchronously', async () => {
    const archiver = new TickDataArchiver(mockPrisma, { maxBufferSize: 10 });
    archiver.recordQuote(sampleQuote);
    expect(archiver.getBufferSize()).toBe(1);

    const flushedCount = await archiver.flush();
    expect(flushedCount).toBe(1);
    expect(archiver.getBufferSize()).toBe(0);
  });

  it('should track spread lifetimes and calculate decay duration', () => {
    const archiver = new TickDataArchiver(mockPrisma);
    const fp = 'SOL-USDC:raydium->orca:10@slot-100';

    archiver.recordOpportunityObserved(fp, 'SOL/USDC', 'raydium', 'orca', 0.50);
    archiver.recordOpportunityObserved(fp, 'SOL/USDC', 'raydium', 'orca', 0.65);

    // Prune with 0ms expiry threshold to simulate expiration
    archiver.pruneExpiredSpreads(0);
    const metrics = archiver.getLifetimeMetrics();

    expect(metrics.length).toBe(1);
    expect(metrics[0].fingerprint).toBe(fp);
    expect(metrics[0].peakNetProfitUsd).toBe(0.65);
  });
});
