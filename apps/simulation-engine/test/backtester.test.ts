import { describe, it, expect } from 'vitest';
import { MarketReplayEngine, HistoricalTick } from '../src/backtester.js';
import { ProfitabilityEngine, RiskEngine, ArbitrageDetector } from '@solana-arbitrage/arbitrage-engine';
import { RedisRepository } from '@solana-arbitrage/database';
import { Quote, TokenPair, TokenInfo } from '@solana-arbitrage/domain';
import { loadConfig } from '@solana-arbitrage/config';
import Decimal from 'decimal.js';

describe('MarketReplayEngine Backtester', () => {
  const config = loadConfig();
  const profitabilityEngine = new ProfitabilityEngine();
  const riskEngine = new RiskEngine(config);

  const mockRedis = {
    lockOpportunityFingerprint: async () => true,
  } as unknown as RedisRepository;

  const detector = new ArbitrageDetector(profitabilityEngine, riskEngine, mockRedis);
  const replayEngine = new MarketReplayEngine(detector);

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

  const pair: TokenPair = {
    id: 'sol-usdc',
    baseToken: solToken,
    quoteToken: usdcToken,
    enabled: true,
  };

  const createQuote = (dexId: string, priceStr: string, slot = 100): Quote => ({
    poolId: `${dexId}-pool`,
    dexId,
    tokenIn: solToken,
    tokenOut: usdcToken,
    inputAmount: BigInt(1000000000),
    expectedOutputAmount: BigInt(180000000),
    price: new Decimal(priceStr),
    feeAmount: BigInt(450000),
    priceImpactPercent: new Decimal('0.0005'),
    estimatedSlippagePercent: new Decimal('0.0010'),
    slot: BigInt(slot),
    timestamp: new Date(),
  });

  it('should replay historical ticks and calculate backtest metrics', async () => {
    const ticks: HistoricalTick[] = [
      // Tick 1: Profitable spread ($180 vs $183)
      {
        timestamp: new Date(),
        pair,
        quoteA: createQuote('raydium', '180.00', 101),
        quoteB: createQuote('orca', '183.00', 101),
      },
      // Tick 2: No spread ($180 vs $180)
      {
        timestamp: new Date(Date.now() + 500),
        pair,
        quoteA: createQuote('raydium', '180.00', 102),
        quoteB: createQuote('orca', '180.00', 102),
      },
      // Tick 3: Profitable reverse spread ($184 vs $181)
      {
        timestamp: new Date(Date.now() + 1000),
        pair,
        quoteA: createQuote('raydium', '184.00', 103),
        quoteB: createQuote('orca', '181.00', 103),
      },
    ];

    const result = await replayEngine.runBacktest(ticks, {
      executionDelayMs: 100,
      simulatedSlippageDecayRate: 0.05,
      initialCapitalUsd: 10.0,
    });

    expect(result.summary.totalTicksEvaluated).toBe(3);
    expect(result.summary.totalOpportunitiesDetected).toBe(2);
    expect(result.summary.totalTradesFilled).toBe(2);
    expect(result.summary.totalNetProfitUsd).toBeGreaterThan(0);
    expect(result.summary.finalCapitalUsd).toBeGreaterThan(10.0);
    expect(result.summary.winRatePercent).toBe(100);
  });
});
