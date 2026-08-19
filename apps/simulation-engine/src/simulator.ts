import Decimal from 'decimal.js';
import { ArbitrageOpportunity } from '@solana-arbitrage/domain';

export interface SimulationResult {
  readonly opportunityId: string;
  readonly success: boolean;
  readonly expectedOutputUsd: Decimal;
  readonly actualOutputUsd: Decimal;
  readonly computeUnits?: bigint;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly simulatedAt: Date;
}

export class TransactionSimulator {
  public async simulateOpportunity(
    opportunity: ArbitrageOpportunity
  ): Promise<SimulationResult> {
    // In Phase 1 paper trading, evaluate simulated fill based on fee and slippage math
    const expectedOutputUsd = opportunity.tradeAmountUsd.add(opportunity.grossProfitUsd);
    const actualOutputUsd = opportunity.tradeAmountUsd.add(opportunity.netProfitUsd);

    return {
      opportunityId: opportunity.id,
      success: true,
      expectedOutputUsd,
      actualOutputUsd,
      computeUnits: BigInt(185000), // Typical compute units for cross-DEX swap
      simulatedAt: new Date(),
    };
  }
}
