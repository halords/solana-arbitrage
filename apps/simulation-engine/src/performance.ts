import Decimal from 'decimal.js';
import { PaperTradeRecord } from '@solana-arbitrage/domain';

export interface PerformanceMetrics {
  readonly totalPaperTrades: number;
  readonly successfulTrades: number;
  readonly failedTrades: number;
  readonly winRatePercent: Decimal;
  readonly totalNetProfitUsd: Decimal;
  readonly averageProfitPerTradeUsd: Decimal;
  readonly totalVolumeUsd: Decimal;
}

export class PerformanceCalculator {
  public calculateMetrics(trades: PaperTradeRecord[]): PerformanceMetrics {
    if (trades.length === 0) {
      return {
        totalPaperTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        winRatePercent: new Decimal(0),
        totalNetProfitUsd: new Decimal(0),
        averageProfitPerTradeUsd: new Decimal(0),
        totalVolumeUsd: new Decimal(0),
      };
    }

    let successful = 0;
    let totalProfit = new Decimal(0);
    let totalVolume = new Decimal(0);

    for (const trade of trades) {
      if (trade.status === 'COMPLETED') {
        successful++;
        totalProfit = totalProfit.add(trade.actualProfitUsd);
      }
      totalVolume = totalVolume.add(trade.inputAmountUsd);
    }

    const winRatePercent = new Decimal(successful).div(trades.length).mul(100);
    const averageProfitPerTradeUsd = totalProfit.div(trades.length);

    return {
      totalPaperTrades: trades.length,
      successfulTrades: successful,
      failedTrades: trades.length - successful,
      winRatePercent,
      totalNetProfitUsd: totalProfit,
      averageProfitPerTradeUsd,
      totalVolumeUsd: totalVolume,
    };
  }
}
