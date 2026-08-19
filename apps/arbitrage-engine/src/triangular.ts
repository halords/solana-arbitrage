import { Quote, TokenInfo } from '@solana-arbitrage/domain';
import Decimal from 'decimal.js';

export interface RouteLeg {
  readonly dexId: string;
  readonly tokenIn: TokenInfo;
  readonly tokenOut: TokenInfo;
  readonly quote: Quote;
  readonly feePercent: Decimal;
}

export interface TriangularRouteResult {
  readonly id: string;
  readonly startToken: TokenInfo;
  readonly legs: [RouteLeg, RouteLeg, RouteLeg];
  readonly inputAmountUsd: Decimal;
  readonly expectedOutputUsd: Decimal;
  readonly grossProfitUsd: Decimal;
  readonly totalFeesUsd: Decimal;
  readonly netProfitUsd: Decimal;
  readonly roiPercent: Decimal;
  readonly isProfitable: boolean;
}

export class TriangularRouteOptimizer {
  private readonly defaultNetworkFeeUsd = new Decimal('0.0015'); // 3 legs of on-chain swaps (~15,000 lamports)
  private readonly defaultSafetyBufferUsd = new Decimal('0.0150');

  public evaluateTriangularRoute(
    leg1: RouteLeg,
    leg2: RouteLeg,
    leg3: RouteLeg,
    inputAmountUsd: Decimal
  ): TriangularRouteResult | null {
    // Validate that the route forms a closed loop: A -> B -> C -> A
    if (
      leg1.tokenOut.symbol !== leg2.tokenIn.symbol ||
      leg2.tokenOut.symbol !== leg3.tokenIn.symbol ||
      leg3.tokenOut.symbol !== leg1.tokenIn.symbol
    ) {
      return null;
    }

    // Step 1: Simulate Leg 1 (Token A -> Token B)
    // tokensOut1 = (inputAmountUsd / leg1.quote.price) * (1 - leg1.feePercent - slippage1)
    const leg1GrossMultiplier = leg1.quote.price;
    const leg1NetMultiplier = leg1GrossMultiplier.mul(new Decimal(1).sub(leg1.feePercent).sub(leg1.quote.estimatedSlippagePercent));
    const tokenBAmount = inputAmountUsd.mul(leg1NetMultiplier);

    // Step 2: Simulate Leg 2 (Token B -> Token C)
    const leg2GrossMultiplier = leg2.quote.price;
    const leg2NetMultiplier = leg2GrossMultiplier.mul(new Decimal(1).sub(leg2.feePercent).sub(leg2.quote.estimatedSlippagePercent));
    const tokenCAmount = tokenBAmount.mul(leg2NetMultiplier);

    // Step 3: Simulate Leg 3 (Token C -> Token A)
    const leg3GrossMultiplier = leg3.quote.price;
    const leg3NetMultiplier = leg3GrossMultiplier.mul(new Decimal(1).sub(leg3.feePercent).sub(leg3.quote.estimatedSlippagePercent));
    const expectedOutputUsd = tokenCAmount.mul(leg3NetMultiplier);

    const grossProfitUsd = expectedOutputUsd.sub(inputAmountUsd);

    // Accumulated fees across 3 legs
    const totalDexFeesUsd = inputAmountUsd
      .mul(leg1.feePercent)
      .add(tokenBAmount.mul(leg2.feePercent))
      .add(tokenCAmount.mul(leg3.feePercent));

    const totalFeesUsd = totalDexFeesUsd.add(this.defaultNetworkFeeUsd).add(this.defaultSafetyBufferUsd);
    const netProfitUsd = grossProfitUsd.sub(totalFeesUsd);
    const roiPercent = netProfitUsd.div(inputAmountUsd).mul(100);

    return {
      id: `tri-${Date.now()}-${leg1.tokenIn.symbol}-${leg2.tokenIn.symbol}-${leg3.tokenIn.symbol}`,
      startToken: leg1.tokenIn,
      legs: [leg1, leg2, leg3],
      inputAmountUsd,
      expectedOutputUsd,
      grossProfitUsd,
      totalFeesUsd,
      netProfitUsd,
      roiPercent,
      isProfitable: netProfitUsd.greaterThan(0),
    };
  }
}
