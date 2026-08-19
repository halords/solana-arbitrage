import { describe, it, expect } from 'vitest';
import {
  MainnetWalletManager,
  CircuitBreaker,
  EmergencyDrainService,
  ArbitrageTransactionBuilder,
} from '@solana-arbitrage/solana';
import { loadConfig } from '@solana-arbitrage/config';
import { ArbitrageOpportunity } from '@solana-arbitrage/domain';
import Decimal from 'decimal.js';
import { Address, generateKeyPairSigner } from '@solana/kit';

describe('Phase 4 Mainnet Alpha Safety Controls', () => {
  const config = loadConfig({
    TRADING_MODE: 'paper',
    MAX_TRADE_USD: '10.00',
    MAX_DAILY_LOSS_USD: '5.00',
    MAX_CONSECUTIVE_LOSSES: '3',
    COLD_STORAGE_ADDRESS: 'ColdStorage1111111111111111111111111111111111' as Address,
  });

  it('CircuitBreaker prevents trades when daily loss limit is breached', () => {
    const cb = new CircuitBreaker(config);
    expect(cb.canTrade(5.0).allowed).toBe(true);

    cb.recordTrade(-2.5);
    cb.recordTrade(-2.6);

    const check = cb.canTrade(5.0);
    expect(check.allowed).toBe(false);
    expect(cb.getState().isTripped).toBe(true);
  });

  it('CircuitBreaker enforces MAX_TRADE_USD threshold', () => {
    const cb = new CircuitBreaker(config);
    const oversizedCheck = cb.canTrade(15.0);
    expect(oversizedCheck.allowed).toBe(false);
    expect(oversizedCheck.reason).toContain('MAX_TRADE_USD');
  });

  it('EmergencyDrainService handles low-balance wallets safely', async () => {
    const drainService = new EmergencyDrainService();
    const mockSigner = { address: 'Signer111111111111111111111111111111111111' as Address };
    const mockRpc = {
      getBalance: () => ({
        send: async () => ({ value: BigInt(1000) }), // Less than 5000 fee
      }),
    };

    const res = await drainService.buildDrainTransaction(
      mockRpc as any,
      mockSigner as any,
      'ColdStorage1111111111111111111111111111111111' as Address
    );

    expect(res.success).toBe(false);
    expect(res.error).toBe('Insufficient balance for drain transaction fee');
  });

  it('ArbitrageTransactionBuilder creates atomic transaction within Solana MTU size', async () => {
    const builder = new ArbitrageTransactionBuilder();
    const mockOpportunity: ArbitrageOpportunity = {
      id: 'opp-safety-1',
      fingerprint: 'fp-1',
      tokenPair: {
        baseToken: {
          id: 't-sol',
          mintAddress: 'So11111111111111111111111111111111111111112',
          symbol: 'SOL',
          name: 'Solana',
          decimals: 9,
          enabled: true,
          whitelisted: true,
        },
        quoteToken: {
          id: 't-usdc',
          mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          enabled: true,
          whitelisted: true,
        },
      },
      buyDexId: 'raydium',
      sellDexId: 'orca',
      tradeAmountUsd: new Decimal('10.00'),
      grossProfitUsd: new Decimal('0.15'),
      dexFeesUsd: new Decimal('0.04'),
      networkFeesUsd: new Decimal('0.001'),
      priorityFeesUsd: new Decimal('0.005'),
      slippageCostUsd: new Decimal('0.01'),
      priceImpactUsd: new Decimal('0.002'),
      safetyBufferUsd: new Decimal('0.005'),
      netProfitUsd: new Decimal('0.087'),
      roiPercent: new Decimal('0.87'),
      status: 'DETECTED',
      detectedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    };

    const mockSigner = await generateKeyPairSigner();

    const mockBlockhash = {
      blockhash: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM' as any,
      lastValidBlockHeight: BigInt(300000),
    };

    const compiled = await builder.buildAtomicArbitrageTransaction(
      mockOpportunity,
      mockSigner,
      mockBlockhash
    );

    expect(compiled.isWithinMtuLimit).toBe(true);
    expect(compiled.byteSize).toBeLessThanOrEqual(1232);
    expect(compiled.instructionCount).toBe(2);
  });
});
