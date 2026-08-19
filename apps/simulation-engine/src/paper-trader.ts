import { ArbitrageOpportunity, PaperTradeRecord } from '@solana-arbitrage/domain';
import { TransactionSimulator } from './simulator.js';
import { Logger } from 'pino';
import { randomUUID } from 'node:crypto';

export class PaperTradingEngine {
  private readonly simulator: TransactionSimulator;
  private readonly logger: Logger | undefined;
  private readonly tradeRecords: PaperTradeRecord[] = [];

  constructor(simulator: TransactionSimulator, logger?: Logger) {
    this.simulator = simulator;
    this.logger = logger;
  }

  public async executePaperTrade(
    opportunity: ArbitrageOpportunity
  ): Promise<PaperTradeRecord | null> {
    // 1. Stale opportunity protection (< 1000ms from detection)
    const now = Date.now();
    if (now > opportunity.expiresAt.getTime()) {
      this.logger?.warn(
        { id: opportunity.id, fingerprint: opportunity.fingerprint },
        'Paper trade rejected: Opportunity expired'
      );
      return null;
    }

    // 2. Run simulation
    const sim = await this.simulator.simulateOpportunity(opportunity);

    // 3. Create paper trade record (mode = 'PAPER' strictly enforced)
    const paperTrade: PaperTradeRecord = {
      id: randomUUID(),
      opportunityId: opportunity.id,
      mode: 'PAPER',
      inputAmountUsd: opportunity.tradeAmountUsd,
      expectedOutputUsd: sim.expectedOutputUsd,
      actualOutputUsd: sim.actualOutputUsd,
      expectedProfitUsd: opportunity.grossProfitUsd,
      actualProfitUsd: opportunity.netProfitUsd,
      status: sim.success ? 'COMPLETED' : 'FAILED',
      createdAt: new Date(),
    };

    this.tradeRecords.push(paperTrade);

    this.logger?.info(
      {
        tradeId: paperTrade.id,
        opportunityId: opportunity.id,
        netProfitUsd: paperTrade.actualProfitUsd.toFixed(4),
        status: paperTrade.status,
      },
      'Paper trade executed successfully'
    );

    return paperTrade;
  }

  public getTradeHistory(): PaperTradeRecord[] {
    return [...this.tradeRecords];
  }
}
