import { describe, it, expect } from 'vitest';
import { TransactionSimulator } from '../src/simulator.js';
import { PaperTradingEngine } from '../src/paper-trader.js';
import { PerformanceCalculator } from '../src/performance.js';
import { ArbitrageOpportunity, TokenPair, TokenInfo } from '@solana-arbitrage/domain';
import Decimal from 'decimal.js';

describe('Simulation Engine & Paper Trader', () => {
  const dummyToken: TokenInfo = {
    id: '1',
    mintAddress: 'mint',
    symbol: 'SOL',
    name: 'SOL',
    decimals: 9,
    enabled: true,
    whitelisted: true,
  };

  const pair: TokenPair = {
    baseToken: dummyToken,
    quoteToken: dummyToken,
  };

  const activeOpportunity: ArbitrageOpportunity = {
    id: 'opp-123',
    fingerprint: 'SOL-USDC:raydium->orca:100@100',
    tokenPair: pair,
    buyDexId: 'raydium',
    sellDexId: 'orca',
    tradeAmountUsd: new Decimal(100),
    grossProfitUsd: new Decimal('1.50'),
    dexFeesUsd: new Decimal('0.55'),
    networkFeesUsd: new Decimal('0.001'),
    priorityFeesUsd: new Decimal('0.002'),
    slippageCostUsd: new Decimal('0.20'),
    priceImpactUsd: new Decimal('0.05'),
    safetyBufferUsd: new Decimal('0.01'),
    netProfitUsd: new Decimal('0.687'),
    roiPercent: new Decimal('0.687'),
    status: 'DETECTED',
    detectedAt: new Date(),
    expiresAt: new Date(Date.now() + 5000), // Valid for 5s
  };

  it('should execute a paper trade and record it with mode PAPER', async () => {
    const simulator = new TransactionSimulator();
    const paperTrader = new PaperTradingEngine(simulator);

    const trade = await paperTrader.executePaperTrade(activeOpportunity);
    expect(trade).not.toBeNull();
    expect(trade?.mode).toBe('PAPER');
    expect(trade?.actualProfitUsd.toFixed(3)).toBe('0.687');
    expect(paperTrader.getTradeHistory().length).toBe(1);
  });

  it('should reject stale opportunities', async () => {
    const simulator = new TransactionSimulator();
    const paperTrader = new PaperTradingEngine(simulator);

    const expiredOpportunity: ArbitrageOpportunity = {
      ...activeOpportunity,
      expiresAt: new Date(Date.now() - 1000), // Expired 1s ago
    };

    const trade = await paperTrader.executePaperTrade(expiredOpportunity);
    expect(trade).toBeNull();
    expect(paperTrader.getTradeHistory().length).toBe(0);
  });

  it('should calculate performance metrics correctly', async () => {
    const simulator = new TransactionSimulator();
    const paperTrader = new PaperTradingEngine(simulator);
    const calculator = new PerformanceCalculator();

    await paperTrader.executePaperTrade(activeOpportunity);
    await paperTrader.executePaperTrade(activeOpportunity);

    const metrics = calculator.calculateMetrics(paperTrader.getTradeHistory());
    expect(metrics.totalPaperTrades).toBe(2);
    expect(metrics.winRatePercent.toNumber()).toBe(100);
    expect(metrics.totalNetProfitUsd.toFixed(3)).toBe('1.374');
  });
});
