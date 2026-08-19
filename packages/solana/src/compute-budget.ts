import { IInstruction, Address } from '@solana/kit';

export interface ComputeBudgetConfig {
  readonly computeUnitLimit?: number; // e.g. 250,000 units
  readonly microLamportsPerCu?: bigint; // e.g. 50,000 micro-lamports
}

export class ComputeBudgetManager {
  public static readonly COMPUTE_BUDGET_PROGRAM_ID =
    'ComputeBudget111111111111111111111111111111' as Address;

  /**
   * Constructs the SetComputeUnitLimit instruction (Index: 2)
   */
  public createSetComputeUnitLimitInstruction(units: number): IInstruction {
    const data = new Uint8Array(5);
    const view = new DataView(data.buffer);
    view.setUint8(0, 2); // SetComputeUnitLimit index
    view.setUint32(1, units, true);

    return {
      programAddress: ComputeBudgetManager.COMPUTE_BUDGET_PROGRAM_ID,
      accounts: [],
      data,
    };
  }

  /**
   * Constructs the SetComputeUnitPrice instruction (Index: 3)
   */
  public createSetComputeUnitPriceInstruction(microLamports: bigint): IInstruction {
    const data = new Uint8Array(9);
    const view = new DataView(data.buffer);
    view.setUint8(0, 3); // SetComputeUnitPrice index
    view.setBigUint64(1, microLamports, true);

    return {
      programAddress: ComputeBudgetManager.COMPUTE_BUDGET_PROGRAM_ID,
      accounts: [],
      data,
    };
  }

  /**
   * Estimates dynamic priority fee from recent fee percentiles
   */
  public calculateDynamicPriorityFee(recentFees: number[], multiplier = 1.2): bigint {
    if (!recentFees || recentFees.length === 0) {
      return BigInt(50_000); // 50,000 micro-lamports default
    }
    const sorted = [...recentFees].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 50_000;
    return BigInt(Math.max(Math.floor(median * multiplier), 10_000));
  }

  /**
   * Builds the full compute budget instruction set to prepend to versioned transactions
   */
  public buildComputeBudgetInstructions(config?: ComputeBudgetConfig): IInstruction[] {
    const limit = config?.computeUnitLimit ?? 250_000;
    const price = config?.microLamportsPerCu ?? BigInt(50_000);

    return [
      this.createSetComputeUnitLimitInstruction(limit),
      this.createSetComputeUnitPriceInstruction(price),
    ];
  }
}

