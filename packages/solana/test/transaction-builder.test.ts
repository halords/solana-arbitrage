import { describe, it, expect } from 'vitest';
import { ArbitrageTransactionBuilder } from '../src/transaction-builder.js';
import { generateKeyPairSigner, Blockhash } from '@solana/kit';
import { ArbitrageOpportunity, TokenPair, TokenInfo } from '@solana-arbitrage/domain';
import Decimal from 'decimal.js';

describe('ArbitrageTransactionBuilder', () => {
  const builder = new ArbitrageTransactionBuilder();

  const solToken: TokenInfo = {
    id: 'sol-id',
    mintAddress: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'SOL',
    decimals: 9,
    enabled: true,
    whitelisted: true,
  };

  const usdcToken: TokenInfo = {
    id: 'usdc-id',
    mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USDC',
    decimals: 6,
    enabled: true,
    whitelisted: true,
  };

  const pair: TokenPair = {
    id: 'sol-usdc',
    baseToken: solToken,
    quoteToken: usdcToken,
    enabled: true,
  };

  const sampleOpportunity: ArbitrageOpportunity = {
    id: 'test-opp-id',
    fingerprint: 'SOL-USDC:raydium->orca:10@slot-100',
    tokenPair: pair,
    buyDexId: 'raydium',
    sellDexId: 'orca',
    tradeAmountUsd: new Decimal(10),
    grossProfitUsd: new Decimal('0.20'),
    dexFeesUsd: new Decimal('0.05'),
    networkFeesUsd: new Decimal('0.0005'),
    priorityFeesUsd: new Decimal('0.0020'),
    slippageCostUsd: new Decimal('0.01'),
    priceImpactUsd: new Decimal('0.005'),
    safetyBufferUsd: new Decimal('0.01'),
    netProfitUsd: new Decimal('0.1225'),
    roiPercent: new Decimal('1.225'),
    status: 'DETECTED',
    detectedAt: new Date(),
    expiresAt: new Date(Date.now() + 1000),
  };

  it('should compile an atomic 2-leg Versioned Transaction within the 1232-byte MTU limit', async () => {
    const signer = await generateKeyPairSigner();
    const dummyBlockhash = {
      blockhash: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM' as Blockhash,
      lastValidBlockHeight: BigInt(250000000),
    };

    const compiled = await builder.buildAtomicArbitrageTransaction(
      sampleOpportunity,
      signer,
      dummyBlockhash
    );

    expect(compiled).toBeDefined();
    expect(compiled.instructionCount).toBe(2);
    expect(compiled.feePayer).toBe(signer.address);
    expect(compiled.byteSize).toBeGreaterThan(0);
    expect(compiled.byteSize).toBeLessThan(1232);
    expect(compiled.isWithinMtuLimit).toBe(true);
  });
});
