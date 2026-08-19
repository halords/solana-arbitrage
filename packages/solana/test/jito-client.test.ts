import { describe, it, expect } from 'vitest';
import { JitoBundleClient } from '@solana-arbitrage/solana';
import { loadConfig } from '@solana-arbitrage/config';
import { Address } from '@solana/kit';

describe('JitoBundleClient', () => {
  const config = loadConfig({
    JITO_ENABLED: 'true',
    JITO_TIP_LAMPORTS: '15000',
  });

  it('should maintain verified official Jito tip account addresses', () => {
    expect(JitoBundleClient.JITO_TIP_ACCOUNTS.length).toBe(8);
    for (const addr of JitoBundleClient.JITO_TIP_ACCOUNTS) {
      expect(addr).toBeDefined();
      expect(typeof addr).toBe('string');
      expect(addr.length).toBeGreaterThanOrEqual(32);
    }
  });

  it('should randomly pick a tip account from the pool', () => {
    const client = new JitoBundleClient(config);
    const account = client.getRandomTipAccount();
    expect(JitoBundleClient.JITO_TIP_ACCOUNTS).toContain(account);
  });

  it('should construct a valid Jito tip instruction', () => {
    const client = new JitoBundleClient(config);
    const mockPayer = 'Payer111111111111111111111111111111111111' as Address;
    const instruction = client.buildJitoTipInstruction(mockPayer);

    expect(instruction.programAddress).toBe(JitoBundleClient.SYSTEM_PROGRAM_ID);
    expect(instruction.accounts.length).toBe(2);
    expect(instruction.accounts[0]?.address).toBe(mockPayer);
    expect(instruction.data.length).toBe(12);

    const view = new DataView(instruction.data.buffer);
    expect(view.getUint32(0, true)).toBe(2); // Transfer instruction index
    expect(view.getBigUint64(4, true)).toBe(BigInt(15000));
  });

  it('should submit an atomic MEV bundle and return a tracked bundle ID', async () => {
    const client = new JitoBundleClient(config);
    const result = await client.sendBundle(['mock-tx-base64']);

    expect(result.bundleId).toMatch(/^jito-bundle-/);
    expect(result.status).toBe('ACCEPTED');
    expect(result.tipLamports).toBe(BigInt(15000));
    expect(result.submittedAt).toBeInstanceOf(Date);
  });
});
