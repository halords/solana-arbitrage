import { Address } from '@solana/kit';

export interface LeaderScheduleEntry {
  readonly slot: bigint;
  readonly leader: Address;
}

export class LeaderSchedulePredictor {
  private readonly leaders: Map<string, Address> = new Map();

  /**
   * Register known leader slot mappings from RPC getLeaderSchedule
   */
  public registerLeaderSlots(leader: Address, slots: bigint[]): void {
    for (const slot of slots) {
      this.leaders.set(slot.toString(), leader);
    }
  }

  /**
   * Determine expected leader for a target slot
   */
  public getLeaderForSlot(slot: bigint): Address | null {
    return this.leaders.get(slot.toString()) || null;
  }

  /**
   * Calculate congestion-aware optimal priority fee
   * Formula: BaseFee + (CongestionMultiplier * ExpectedProfitLamports) capped at MaxPriorityFee
   */
  public calculateOptimalBid(
    expectedProfitLamports: bigint,
    congestionMultiplier = 0.15,
    maxFeeCap = BigInt(500_000)
  ): bigint {
    const variableFee = BigInt(
      Math.floor(Number(expectedProfitLamports) * congestionMultiplier)
    );
    const baseFee = BigInt(50_000); // 50k micro-lamports minimum
    const totalBid = baseFee + variableFee;

    return totalBid > maxFeeCap ? maxFeeCap : totalBid;
  }
}
