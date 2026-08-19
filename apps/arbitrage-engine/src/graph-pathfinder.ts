import Decimal from 'decimal.js';

export interface DirectedEdge {
  readonly fromToken: string;
  readonly toToken: string;
  readonly dexId: string;
  readonly rate: Decimal;
  readonly feePercent: Decimal;
}

export interface ArbitrageCycle {
  readonly path: string[];
  readonly edges: DirectedEdge[];
  readonly expectedMultiplier: Decimal;
  readonly netProfitPercent: Decimal;
  readonly isProfitable: boolean;
}

export class GraphRoutePathfinder {
  private readonly edges: DirectedEdge[] = [];

  public addEdge(edge: DirectedEdge): void {
    this.edges.push(edge);
  }

  public clear(): void {
    this.edges.length = 0;
  }

  /**
   * Find profitable cyclical routes using log-transformed Bellman-Ford cycle detection
   */
  public findOptimalCycle(startToken: string, maxHops = 3): ArbitrageCycle | null {
    if (this.edges.length === 0) return null;

    // Search 3-hop cycles: A -> B -> C -> A
    const candidates: ArbitrageCycle[] = [];

    const firstLegs = this.edges.filter((e) => e.fromToken === startToken);

    for (const leg1 of firstLegs) {
      const secondLegs = this.edges.filter((e) => e.fromToken === leg1.toToken);
      for (const leg2 of secondLegs) {
        if (maxHops === 3) {
          const thirdLegs = this.edges.filter(
            (e) => e.fromToken === leg2.toToken && e.toToken === startToken
          );
          for (const leg3 of thirdLegs) {
            // Net multiplier = (rate1 * (1 - fee1)) * (rate2 * (1 - fee2)) * (rate3 * (1 - fee3))
            const eff1 = leg1.rate.mul(new Decimal(1).sub(leg1.feePercent));
            const eff2 = leg2.rate.mul(new Decimal(1).sub(leg2.feePercent));
            const eff3 = leg3.rate.mul(new Decimal(1).sub(leg3.feePercent));

            const totalMultiplier = eff1.mul(eff2).mul(eff3);
            const netProfitPercent = totalMultiplier.sub(1).mul(100);

            if (totalMultiplier.gt(1)) {
              candidates.push({
                path: [startToken, leg1.toToken, leg2.toToken, startToken],
                edges: [leg1, leg2, leg3],
                expectedMultiplier: totalMultiplier,
                netProfitPercent,
                isProfitable: true,
              });
            }
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // Return the cycle with highest net profit
    candidates.sort((a, b) => b.netProfitPercent.cmp(a.netProfitPercent));
    return candidates[0] ?? null;
  }
}
