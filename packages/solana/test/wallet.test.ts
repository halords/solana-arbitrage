import { describe, it, expect } from 'vitest';
import { DevnetWalletManager } from '../src/wallet.js';
import { loadConfig } from '@solana-arbitrage/config';

describe('DevnetWalletManager', () => {
  const config = loadConfig();

  it('should initialize and derive a valid Solana Address without exposing secret keys', async () => {
    const manager = new DevnetWalletManager(config);
    const signer = await manager.initializeSigner();

    expect(signer).toBeDefined();
    expect(typeof signer.address).toBe('string');
    expect(signer.address.length).toBeGreaterThanOrEqual(32);
    expect(manager.getPublicKeyAddress()).toBe(signer.address);
  });

  it('should correctly evaluate airdrop necessity based on SOL balance thresholds', async () => {
    const manager = new DevnetWalletManager(config);
    await manager.initializeSigner();

    // 0.1 SOL -> Needs Airdrop (since MIN_DEVNET_SOL = 0.5)
    const lowBalance = manager.evaluateAirdropNeed(BigInt(100_000_000));
    expect(lowBalance.sol).toBe(0.1);
    expect(lowBalance.needsAirdrop).toBe(true);

    // 1.5 SOL -> Healthy balance
    const healthyBalance = manager.evaluateAirdropNeed(BigInt(1_500_000_000));
    expect(healthyBalance.sol).toBe(1.5);
    expect(healthyBalance.needsAirdrop).toBe(false);
  });
});
