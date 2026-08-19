import Decimal from 'decimal.js';
import { Quote } from '@solana-arbitrage/domain';

export interface ProfitabilityCalculationInput {
  readonly buyQuote: Quote;
  readonly sellQuote: Quote;
  readonly tradeAmountUsd: Decimal;
  readonly networkFeeUsd?: Decimal;
  readonly priorityFeeUsd?: Decimal;
  readonly safetyBufferUsd?: Decimal;
}

export interface ProfitabilityCalculationResult {
  readonly tradeAmountUsd: Decimal;
  readonly grossProfitUsd: Decimal;
  readonly dexFeesUsd: Decimal;
  readonly networkFeesUsd: Decimal;
  readonly priorityFeesUsd: Decimal;
  readonly slippageCostUsd: Decimal;
  readonly priceImpactUsd: Decimal;
  readonly safetyBufferUsd: Decimal;
  readonly netProfitUsd: Decimal;
  readonly roiPercent: Decimal;
  readonly isProfitable: boolean;
}

export class ProfitabilityEngine {
  private readonly defaultNetworkFeeUsd = new Decimal('0.0005'); // 5000 lamports at $180 SOL ~ $0.0009, conservative $0.0005
  private readonly defaultPriorityFeeUsd = new Decimal('0.0020'); // Compute unit priority fee buffer
  private readonly defaultSafetyBufferUsd = new Decimal('0.0100'); // $0.01 buffer

  public calculateProfitability(
    input: ProfitabilityCalculationInput
  ): ProfitabilityCalculationResult {
    const buyPrice = input.buyQuote.price;
    const sellPrice = input.sellQuote.price;

    // Price spread gross profit
    // Trade Amount in tokens bought = tradeAmountUsd / buyPrice
    // Revenue when sold = (tradeAmountUsd / buyPrice) * sellPrice
    const grossProfitUsd = input.tradeAmountUsd
      .div(buyPrice)
      .mul(sellPrice)
      .sub(input.tradeAmountUsd);

    // DEX Fees
    const buyDexFeeUsd = input.tradeAmountUsd.mul(new Decimal('0.0025')); // e.g. 0.25%
    const sellDexFeeUsd = input.tradeAmountUsd.mul(new Decimal('0.0030')); // e.g. 0.30%
    const dexFeesUsd = buyDexFeeUsd.add(sellDexFeeUsd);

    // Network & Priority Fees
    const networkFeesUsd = input.networkFeeUsd ?? this.defaultNetworkFeeUsd;
    const priorityFeesUsd = input.priorityFeeUsd ?? this.defaultPriorityFeeUsd;

    // Slippage and Price Impact estimates
    const totalSlippagePercent = input.buyQuote.estimatedSlippagePercent.add(
      input.sellQuote.estimatedSlippagePercent
    );
    const slippageCostUsd = input.tradeAmountUsd.mul(totalSlippagePercent);

    const totalPriceImpactPercent = input.buyQuote.priceImpactPercent.add(
      input.sellQuote.priceImpactPercent
    );
    const priceImpactUsd = input.tradeAmountUsd.mul(totalPriceImpactPercent);

    const safetyBufferUsd = input.safetyBufferUsd ?? this.defaultSafetyBufferUsd;

    // Formula from SRS FR-013:
    // Net Profit = Gross Profit - DEX Fees - Network Fees - Priority Fees - Slippage Cost - Price Impact - Safety Buffer
    const netProfitUsd = grossProfitUsd
      .sub(dexFeesUsd)
      .sub(networkFeesUsd)
      .sub(priorityFeesUsd)
      .sub(slippageCostUsd)
      .sub(priceImpactUsd)
      .sub(safetyBufferUsd);

    const roiPercent = netProfitUsd.div(input.tradeAmountUsd).mul(100);

    return {
      tradeAmountUsd: input.tradeAmountUsd,
      grossProfitUsd,
      dexFeesUsd,
      networkFeesUsd,
      priorityFeesUsd,
      slippageCostUsd,
      priceImpactUsd,
      safetyBufferUsd,
      netProfitUsd,
      roiPercent,
      isProfitable: netProfitUsd.greaterThan(0),
    };
  }

  public optimizeTradeSize(
    buyQuote: Quote,
    sellQuote: Quote,
    sizes: number[] = [1, 2.5, 5, 10],
    maxTradeUsd = 10
  ): ProfitabilityCalculationResult | null {
    let bestResult: ProfitabilityCalculationResult | null = null;

    for (const size of sizes) {
      if (size > maxTradeUsd) continue;
      const result = this.calculateProfitability({
        buyQuote,
        sellQuote,
        tradeAmountUsd: new Decimal(size),
      });

      if (result.isProfitable) {
        if (!bestResult || result.netProfitUsd.greaterThan(bestResult.netProfitUsd)) {
          bestResult = result;
        }
      }
    }

    return bestResult;
  }
}
