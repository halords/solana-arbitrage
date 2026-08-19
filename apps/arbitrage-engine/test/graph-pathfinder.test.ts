import { describe, it, expect } from 'vitest';
import { GraphRoutePathfinder } from '../src/graph-pathfinder.js';
import Decimal from 'decimal.js';

describe('GraphRoutePathfinder', () => {
  it('should identify profitable 3-hop cycles', () => {
    const pathfinder = new GraphRoutePathfinder();

    // SOL -> USDC (180.00 rate, 0.25% fee)
    pathfinder.addEdge({
      fromToken: 'SOL',
      toToken: 'USDC',
      dexId: 'raydium',
      rate: new Decimal('180.00'),
      feePercent: new Decimal('0.0025'),
    });

    // USDC -> USDT (1.005 rate, 0.05% fee)
    pathfinder.addEdge({
      fromToken: 'USDC',
      toToken: 'USDT',
      dexId: 'orca',
      rate: new Decimal('1.005'),
      feePercent: new Decimal('0.0005'),
    });

    // USDT -> SOL (1 / 175.00 rate = ~0.005714, 0.25% fee) -> spread creates profit
    pathfinder.addEdge({
      fromToken: 'USDT',
      toToken: 'SOL',
      dexId: 'meteora',
      rate: new Decimal(1).div(new Decimal('175.00')),
      feePercent: new Decimal('0.0025'),
    });

    const cycle = pathfinder.findOptimalCycle('SOL', 3);
    expect(cycle).not.toBeNull();
    expect(cycle?.isProfitable).toBe(true);
    expect(cycle?.path).toEqual(['SOL', 'USDC', 'USDT', 'SOL']);
    expect(cycle?.netProfitPercent.toNumber()).toBeGreaterThan(0);
  });

  it('should return null when no profitable cycle exists', () => {
    const pathfinder = new GraphRoutePathfinder();

    // Balanced rates with standard fees
    pathfinder.addEdge({
      fromToken: 'SOL',
      toToken: 'USDC',
      dexId: 'raydium',
      rate: new Decimal('180.00'),
      feePercent: new Decimal('0.003'),
    });
    pathfinder.addEdge({
      fromToken: 'USDC',
      toToken: 'SOL',
      dexId: 'orca',
      rate: new Decimal(1).div(new Decimal('180.00')),
      feePercent: new Decimal('0.003'),
    });

    const cycle = pathfinder.findOptimalCycle('SOL', 3);
    expect(cycle).toBeNull();
  });
});
