import Decimal from 'decimal.js';
import { AppConfig } from '@solana-arbitrage/config';
import { RiskEvaluationResult, Quote } from '@solana-arbitrage/domain';
import { ProfitabilityCalculationResult } from './profitability.js';

export class RiskEngine {
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  public evaluateOpportunity(
    calc: ProfitabilityCalculationResult,
    buyQuote: Quote,
    sellQuote: Quote
  ): RiskEvaluationResult {
    // 1. Max Trade Amount Check
    if (calc.tradeAmountUsd.greaterThan(this.config.MAX_TRADE_USD)) {
      return {
        isAllowed: false,
        ruleName: 'MAX_TRADE_USD',
        violationReason: `Trade amount $${calc.tradeAmountUsd.toFixed(2)} exceeds max allowed $${this.config.MAX_TRADE_USD.toFixed(2)}`,
        threshold: new Decimal(this.config.MAX_TRADE_USD),
        actualValue: calc.tradeAmountUsd,
      };
    }

    // 2. Minimum Net Profit Check
    if (calc.netProfitUsd.lessThan(this.config.MIN_PROFIT_USD)) {
      return {
        isAllowed: false,
        ruleName: 'MIN_PROFIT_USD',
        violationReason: `Net profit $${calc.netProfitUsd.toFixed(4)} is below minimum threshold $${this.config.MIN_PROFIT_USD.toFixed(4)}`,
        threshold: new Decimal(this.config.MIN_PROFIT_USD),
        actualValue: calc.netProfitUsd,
      };
    }

    // 3. Minimum ROI Check
    if (calc.roiPercent.lessThan(this.config.MIN_ROI_PERCENT)) {
      return {
        isAllowed: false,
        ruleName: 'MIN_ROI_PERCENT',
        violationReason: `ROI ${calc.roiPercent.toFixed(2)}% is below minimum threshold ${this.config.MIN_ROI_PERCENT.toFixed(2)}%`,
        threshold: new Decimal(this.config.MIN_ROI_PERCENT),
        actualValue: calc.roiPercent,
      };
    }

    // 4. Maximum Slippage Check
    // Handle both 0.30 (as percent) and 0.0030 (as decimal fraction)
    const rawThreshold = new Decimal(this.config.MAX_SLIPPAGE_PERCENT);
    const maxAllowedSlippage = rawThreshold.greaterThan(0.01) ? rawThreshold.div(100) : rawThreshold;
    if (
      buyQuote.estimatedSlippagePercent.greaterThan(maxAllowedSlippage) ||
      sellQuote.estimatedSlippagePercent.greaterThan(maxAllowedSlippage)
    ) {
      return {
        isAllowed: false,
        ruleName: 'MAX_SLIPPAGE_PERCENT',
        violationReason: `Slippage exceeds maximum allowed threshold of ${this.config.MAX_SLIPPAGE_PERCENT}%`,
        threshold: maxAllowedSlippage,
      };
    }

    // 5. Stale Quote Check
    const now = Date.now();
    const buyAge = Math.abs(now - buyQuote.timestamp.getTime());
    const sellAge = Math.abs(now - sellQuote.timestamp.getTime());
    if (buyAge > this.config.MAX_QUOTE_AGE_MS || sellAge > this.config.MAX_QUOTE_AGE_MS) {
      return {
        isAllowed: false,
        ruleName: 'MAX_QUOTE_AGE_MS',
        violationReason: `Quotes are stale (buy age: ${buyAge}ms, sell age: ${sellAge}ms)`,
        threshold: new Decimal(this.config.MAX_QUOTE_AGE_MS),
      };
    }

    return {
      isAllowed: true,
    };
  }
}
