import { describe, it, expect } from 'vitest';
import {
  DevnetWalletManager,
  ComputeBudgetManager,
  ArbitrageTransactionBuilder,
  TransactionBroadcaster,
} from '@solana-arbitrage/solana';
import {
  ProfitabilityEngine,
  RiskEngine,
  ArbitrageDetector,
} from '@solana-arbitrage/arbitrage-engine';
import { RedisRepository } from '@solana-arbitrage/database';
import { TokenInfo, TokenPair, Quote } from '@solana-arbitrage/domain';
import { loadConfig } from '@solana-arbitrage/config';
import { Rpc, SolanaRpcApi, Blockhash } from '@solana/kit';
import Decimal from 'decimal.js';

describe('Phase 3 Devnet End-to-End Execution Pipeline', () => {
  const config = loadConfig();

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

  const createQuote = (dexId: string, priceStr: string, slot: number): Quote => ({
    poolId: `${dexId}-pool`,
    dexId,
    tokenIn: solToken,
    tokenOut: usdcToken,
    inputAmount: BigInt(1000000000),
    expectedOutputAmount: BigInt(180000000),
    price: new Decimal(priceStr),
    feeAmount: BigInt(450000),
    priceImpactPercent: new Decimal('0.0005'),
    estimatedSlippagePercent: new Decimal('0.0010'),
    slot: BigInt(slot),
    timestamp: new Date(),
  });

  it('should execute full Devnet workflow: Detect Opportunity -> Prep Budget -> Build Atomic Tx -> Sign & Broadcast', async () => {
    // 1. Initialize Wallet Manager & derive KeyPairSigner
    const walletManager = new DevnetWalletManager(config);
    const signer = await walletManager.initializeSigner();
    expect(signer.address).toBeDefined();

    // 2. Detect Arbitrage Opportunity
    const profitabilityEngine = new ProfitabilityEngine();
    const riskEngine = new RiskEngine(config);
    const mockRedis = {
      lockOpportunityFingerprint: async () => true,
    } as unknown as RedisRepository;

    const detector = new ArbitrageDetector(profitabilityEngine, riskEngine, mockRedis);
    const quoteRaydium = createQuote('raydium', '180.00', 250000100);
    const quoteOrca = createQuote('orca', '182.50', 250000100);

    const opportunity = await detector.evaluateBidirectional(pair, quoteRaydium, quoteOrca);
    expect(opportunity).not.toBeNull();
    if (!opportunity) return;

    // 3. Construct Dynamic Priority Fee & Compute Budget Instructions
    const computeBudget = new ComputeBudgetManager();
    const computeInstructions = computeBudget.buildComputeBudgetInstructions({
      computeUnitLimit: 300_000,
      microLamportsPerCu: BigInt(100_000),
    });
    expect(computeInstructions.length).toBe(2);

    // 4. Build Atomic Versioned Transaction (v0)
    const txBuilder = new ArbitrageTransactionBuilder();
    const dummyBlockhash = {
      blockhash: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM' as Blockhash,
      lastValidBlockHeight: BigInt(250000100),
    };

    const compiledTx = await txBuilder.buildAtomicArbitrageTransaction(
      opportunity,
      signer,
      dummyBlockhash,
      computeInstructions
    );

    expect(compiledTx.instructionCount).toBe(4); // 2 compute budget + 2 swap legs
    expect(compiledTx.isWithinMtuLimit).toBe(true);
    expect(compiledTx.byteSize).toBeLessThan(1232);

    // 5. Broadcast to Solana RPC and track confirmation metrics
    const mockRpc = {} as unknown as Rpc<SolanaRpcApi>;
    const broadcaster = new TransactionBroadcaster(mockRpc);
    const broadcastResult = await broadcaster.broadcastAndConfirm(compiledTx.serializedBytes);

    expect(broadcastResult.status).toBe('CONFIRMED');
    expect(broadcastResult.signature).toBeDefined();
    expect(broadcastResult.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
