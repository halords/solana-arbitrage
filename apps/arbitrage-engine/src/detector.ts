import { Quote, ArbitrageOpportunity, TokenPair } from '@solana-arbitrage/domain';
import { ProfitabilityEngine } from './profitability.js';
import { RiskEngine } from './risk.js';
import { RedisRepository } from '@solana-arbitrage/database';
import { Logger } from 'pino';

import { randomUUID } from 'node:crypto';

export class ArbitrageDetector {
  private readonly profitabilityEngine: ProfitabilityEngine;
  private readonly riskEngine: RiskEngine;
  private readonly redis: RedisRepository;
  private readonly logger: Logger | undefined;

  constructor(
    profitabilityEngine: ProfitabilityEngine,
    riskEngine: RiskEngine,
    redis: RedisRepository,
    logger?: Logger
  ) {
    this.profitabilityEngine = profitabilityEngine;
    this.riskEngine = riskEngine;
    this.redis = redis;
    this.logger = logger;
  }

  public generateFingerprint(
    pair: TokenPair,
    buyDex: string,
    sellDex: string,
    amount: string,
    slot: string
  ): string {
    return `${pair.baseToken.symbol}-${pair.quoteToken.symbol}:${buyDex}->${sellDex}:${amount}@slot-${slot}`;
  }

  public async evaluateBidirectional(
    pair: TokenPair,
    quoteA: Quote,
    quoteB: Quote
  ): Promise<ArbitrageOpportunity | null> {
    // Direction 1: Buy on A, Sell on B
    const opp1 = await this.evaluateDirection(pair, quoteA, quoteB);
    if (opp1) return opp1;

    // Direction 2: Buy on B, Sell on A
    return this.evaluateDirection(pair, quoteB, quoteA);
  }

  private async evaluateDirection(
    pair: TokenPair,
    buyQuote: Quote,
    sellQuote: Quote
  ): Promise<ArbitrageOpportunity | null> {
    if (buyQuote.price.greaterThanOrEqualTo(sellQuote.price)) {
      return null;
    }

    const optimal = this.profitabilityEngine.optimizeTradeSize(buyQuote, sellQuote);
    if (!optimal || !optimal.isProfitable) {
      return null;
    }

    const riskResult = this.riskEngine.evaluateOpportunity(optimal, buyQuote, sellQuote);
    if (!riskResult.isAllowed) {
      return null;
    }

    const fingerprint = this.generateFingerprint(
      pair,
      buyQuote.dexId,
      sellQuote.dexId,
      optimal.tradeAmountUsd.toString(),
      buyQuote.slot.toString()
    );

    // Deduplication via Redis lock (1000ms TTL)
    const isNew = await this.redis.lockOpportunityFingerprint(fingerprint, 1000);
    if (!isNew) {
      this.logger?.debug({ fingerprint }, 'Opportunity fingerprint already locked/processed');
      return null;
    }

    const opportunity: ArbitrageOpportunity = {
      id: randomUUID(),
      fingerprint,
      tokenPair: pair,
      buyDexId: buyQuote.dexId,
      sellDexId: sellQuote.dexId,
      tradeAmountUsd: optimal.tradeAmountUsd,
      grossProfitUsd: optimal.grossProfitUsd,
      dexFeesUsd: optimal.dexFeesUsd,
      networkFeesUsd: optimal.networkFeesUsd,
      priorityFeesUsd: optimal.priorityFeesUsd,
      slippageCostUsd: optimal.slippageCostUsd,
      priceImpactUsd: optimal.priceImpactUsd,
      safetyBufferUsd: optimal.safetyBufferUsd,
      netProfitUsd: optimal.netProfitUsd,
      roiPercent: optimal.roiPercent,
      status: 'DETECTED',
      detectedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000), // 1000ms expiration window
    };

    this.logger?.info(
      {
        fingerprint,
        pair: `${pair.baseToken.symbol}/${pair.quoteToken.symbol}`,
        netProfitUsd: optimal.netProfitUsd.toFixed(4),
        roi: optimal.roiPercent.toFixed(2),
      },
      'Qualified Arbitrage Opportunity Detected'
    );

    return opportunity;
  }
}
