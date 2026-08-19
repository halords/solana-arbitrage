import { Quote, TokenPair } from '@solana-arbitrage/domain';
import { ArbitrageDetector } from '@solana-arbitrage/arbitrage-engine';

export interface HistoricalTick {
  readonly timestamp: Date;
  readonly pair: TokenPair;
  readonly quoteA: Quote;
  readonly quoteB: Quote;
}

export interface BacktestOptions {
  readonly executionDelayMs?: number; // Simulated network delay before fill (e.g. 50ms, 150ms, 300ms)
  readonly simulatedSlippageDecayRate?: number; // Decay rate of profit per 100ms of delay (e.g. 0.05 = 5% decay)
  readonly initialCapitalUsd?: number;
}

export interface BacktestTradeResult {
  readonly opportunityId: string;
  readonly timestamp: Date;
  readonly expectedProfitUsd: number;
  readonly actualProfitUsd: number;
  readonly executionDelayMs: number;
  readonly netProfitUsd: number;
  readonly status: 'FILLED' | 'SLIPPED_AND_REJECTED' | 'EXPIRED';
}

export interface BacktestSummary {
  readonly totalTicksEvaluated: number;
  readonly totalOpportunitiesDetected: number;
  readonly totalTradesAttempted: number;
  readonly totalTradesFilled: number;
  readonly totalNetProfitUsd: number;
  readonly initialCapitalUsd: number;
  readonly finalCapitalUsd: number;
  readonly totalReturnPercent: number;
  readonly winRatePercent: number;
  readonly maxDrawdownUsd: number;
  readonly maxDrawdownPercent: number;
  readonly profitFactor: number;
}

export class MarketReplayEngine {
  private readonly detector: ArbitrageDetector;

  constructor(detector: ArbitrageDetector) {
    this.detector = detector;
  }

  public async runBacktest(
    tickHistory: HistoricalTick[],
    options?: BacktestOptions
  ): Promise<{ summary: BacktestSummary; trades: BacktestTradeResult[] }> {
    const delayMs = options?.executionDelayMs ?? 100;
    const decayRate = options?.simulatedSlippageDecayRate ?? 0.05;
    const initialCapital = options?.initialCapitalUsd ?? 10.0;

    const trades: BacktestTradeResult[] = [];
    let detectedCount = 0;
    let runningCapital = initialCapital;
    let peakCapital = initialCapital;
    let maxDrawdownUsd = 0;
    let grossWins = 0;
    let grossLosses = 0;

    for (const tick of tickHistory) {
      const opportunity = await this.detector.evaluateBidirectional(
        tick.pair,
        tick.quoteA,
        tick.quoteB
      );

      if (opportunity) {
        detectedCount++;

        // Simulate execution delay & spread compression decay
        const delayDecayFactor = Math.max(0, 1 - (delayMs / 100) * decayRate);
        const expectedProfit = opportunity.netProfitUsd.toNumber();
        const realizedProfit = expectedProfit * delayDecayFactor;

        // If spread completely eroded or became negative, mark as slipped/rejected
        if (realizedProfit <= 0) {
          trades.push({
            opportunityId: opportunity.id,
            timestamp: tick.timestamp,
            expectedProfitUsd: expectedProfit,
            actualProfitUsd: 0,
            executionDelayMs: delayMs,
            netProfitUsd: 0,
            status: 'SLIPPED_AND_REJECTED',
          });
        } else {
          trades.push({
            opportunityId: opportunity.id,
            timestamp: tick.timestamp,
            expectedProfitUsd: expectedProfit,
            actualProfitUsd: realizedProfit,
            executionDelayMs: delayMs,
            netProfitUsd: realizedProfit,
            status: 'FILLED',
          });

          runningCapital += realizedProfit;
          grossWins += realizedProfit;

          if (runningCapital > peakCapital) {
            peakCapital = runningCapital;
          }

          const currentDrawdown = peakCapital - runningCapital;
          if (currentDrawdown > maxDrawdownUsd) {
            maxDrawdownUsd = currentDrawdown;
          }
        }
      }
    }

    const filledTrades = trades.filter((t) => t.status === 'FILLED');
    const totalNetProfit = runningCapital - initialCapital;
    const totalReturnPercent = (totalNetProfit / initialCapital) * 100;
    const winRatePercent = trades.length > 0 ? (filledTrades.length / trades.length) * 100 : 100;
    const maxDrawdownPercent = peakCapital > 0 ? (maxDrawdownUsd / peakCapital) * 100 : 0;
    const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? grossWins : 1.0;

    const summary: BacktestSummary = {
      totalTicksEvaluated: tickHistory.length,
      totalOpportunitiesDetected: detectedCount,
      totalTradesAttempted: trades.length,
      totalTradesFilled: filledTrades.length,
      totalNetProfitUsd: parseFloat(totalNetProfit.toFixed(4)),
      initialCapitalUsd: initialCapital,
      finalCapitalUsd: parseFloat(runningCapital.toFixed(4)),
      totalReturnPercent: parseFloat(totalReturnPercent.toFixed(2)),
      winRatePercent: parseFloat(winRatePercent.toFixed(1)),
      maxDrawdownUsd: parseFloat(maxDrawdownUsd.toFixed(4)),
      maxDrawdownPercent: parseFloat(maxDrawdownPercent.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
    };

    return { summary, trades };
  }
}
