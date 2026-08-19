import { describe, it, expect } from 'vitest';
import { LeaderSchedulePredictor } from '@solana-arbitrage/solana';
import { Address } from '@solana/kit';

describe('LeaderSchedulePredictor', () => {
  it('should track slot leader assignments', () => {
    const predictor = new LeaderSchedulePredictor();
    const mockValidator = 'LeaderValidator1111111111111111111111111' as Address;

    predictor.registerLeaderSlots(mockValidator, [BigInt(100), BigInt(101), BigInt(102)]);

    expect(predictor.getLeaderForSlot(BigInt(101))).toBe(mockValidator);
    expect(predictor.getLeaderForSlot(BigInt(200))).toBeNull();
  });

  it('should compute optimal fee bids with profit-proportional scaling and fee caps', () => {
    const predictor = new LeaderSchedulePredictor();

    // Low profit: base fee dominant
    const lowBid = predictor.calculateOptimalBid(BigInt(10_000));
    expect(lowBid).toBeGreaterThanOrEqual(BigInt(50_000));

    // High profit: scales up but honors maxFeeCap
    const highBid = predictor.calculateOptimalBid(BigInt(10_000_000), 0.15, BigInt(300_000));
    expect(highBid).toBe(BigInt(300_000));
  });
});
