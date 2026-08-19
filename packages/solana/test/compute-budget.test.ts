import { describe, it, expect } from 'vitest';
import { ComputeBudgetManager } from '../src/compute-budget.js';

describe('ComputeBudgetManager', () => {
  const manager = new ComputeBudgetManager();

  it('should construct valid SetComputeUnitLimit instruction binary payload', () => {
    const ix = manager.createSetComputeUnitLimitInstruction(300_000);
    expect(ix.programAddress).toBe(ComputeBudgetManager.COMPUTE_BUDGET_PROGRAM_ID);
    expect(ix.accounts.length).toBe(0);
    expect(ix.data.length).toBe(5);

    const view = new DataView(ix.data.buffer);
    expect(view.getUint8(0)).toBe(2); // SetComputeUnitLimit index
    expect(view.getUint32(1, true)).toBe(300_000);
  });

  it('should construct valid SetComputeUnitPrice instruction binary payload', () => {
    const ix = manager.createSetComputeUnitPriceInstruction(BigInt(100_000));
    expect(ix.programAddress).toBe(ComputeBudgetManager.COMPUTE_BUDGET_PROGRAM_ID);
    expect(ix.accounts.length).toBe(0);
    expect(ix.data.length).toBe(9);

    const view = new DataView(ix.data.buffer);
    expect(view.getUint8(0)).toBe(3); // SetComputeUnitPrice index
    expect(view.getBigUint64(1, true)).toBe(BigInt(100_000));
  });

  it('should generate complete compute budget instruction set', () => {
    const instructions = manager.buildComputeBudgetInstructions({
      computeUnitLimit: 250_000,
      microLamportsPerCu: BigInt(75_000),
    });

    expect(instructions.length).toBe(2);
    expect(instructions[0].programAddress).toBe(ComputeBudgetManager.COMPUTE_BUDGET_PROGRAM_ID);
    expect(instructions[1].programAddress).toBe(ComputeBudgetManager.COMPUTE_BUDGET_PROGRAM_ID);
  });
});
