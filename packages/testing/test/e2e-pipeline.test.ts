import { describe, it, expect } from 'vitest';
import { loadConfig } from '@solana-arbitrage/config';
import { TokenInfo, TokenPair, Quote, ArbitrageOpportunity, PaperTradeRecord } from '@solana-arbitrage/domain';
import { DexAdapterRegistry, RaydiumAdapter, OrcaAdapter } from '@solana-arbitrage/dex-adapters';
import { TokenAndPoolRegistry } from '@solana-arbitrage/market-data';
import { ProfitabilityEngine, RiskEngine, ArbitrageDetector } from '@solana-arbitrage/arbitrage-engine';
import { TransactionSimulator, PaperTradingEngine, PerformanceCalculator } from '@solana-arbitrage/simulation-engine';
import { buildServer } from '@solana-arbitrage/api';
import { PrismaClient, RedisRepository } from '@solana-arbitrage/database';
import { SolanaHealthMonitor } from '@solana-arbitrage/solana';
import Decimal from 'decimal.js';

describe('Phase 1 Full End-to-End Pipeline Integration', () => {
  const config = loadConfig({
    TRADING_MODE: 'paper',
    RAYDIUM_ENABLED: 'true',
    ORCA_ENABLED: 'true',
    MAX_TRADE_USD: '100',
    MIN_PROFIT_USD: '0.01',
    MIN_ROI_PERCENT: '0.01',
    MAX_SLIPPAGE_PERCENT: '0.30',
    MAX_QUOTE_AGE_MS: '60000',
  });

  const solToken: TokenInfo = {
    id: 'sol-id',
    mintAddress: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Wrapped SOL',
    decimals: 9,
    enabled: true,
    whitelisted: true,
  };

  const usdcToken: TokenInfo = {
    id: 'usdc-id',
    mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    enabled: true,
    whitelisted: true,
  };

  const pair: TokenPair = {
    baseToken: solToken,
    quoteToken: usdcToken,
  };

  it('should execute end-to-end flow: Market Data -> Detector -> Profitability -> Risk -> Simulation -> Paper Trade -> API -> Status', async () => {
    // 1. Setup Mock DB & Redis
    const opportunityStore: ArbitrageOpportunity[] = [];
    const tradeStore: PaperTradeRecord[] = [];

    const mockPrisma = {
      $queryRaw: async () => [{ '?column?': 1 }],
      token: {
        findMany: async () => [solToken, usdcToken],
      },
      dex: {
        findMany: async () => [
          { id: '1', name: 'Raydium', adapterName: 'raydium', enabled: true },
          { id: '2', name: 'Orca', adapterName: 'orca', enabled: true },
        ],
      },
      pool: { findMany: async () => [] },
      opportunity: {
        count: async () => opportunityStore.length,
        findMany: async () => opportunityStore,
        create: async (args: { data: ArbitrageOpportunity }) => {
          opportunityStore.push(args.data);
          return args.data;
        },
        findUnique: async (args: { where: { id: string } }) => opportunityStore.find((o) => o.id === args.where.id),
      },
      trade: {
        findMany: async () => tradeStore,
        create: async (args: { data: PaperTradeRecord }) => {
          tradeStore.push(args.data);
          return args.data;
        },
      },
      systemEvent: {
        create: async () => ({ id: BigInt(1) }),
      },
    } as unknown as PrismaClient;

    const redisCache = new Map<string, string>();
    const mockRedis = {
      checkHealth: async () => ({ isHealthy: true, latencyMs: 1, lastCheckedAt: new Date() }),
      setMarketPrice: async (id: string, data: Record<string, unknown>) => {
        redisCache.set(id, JSON.stringify(data));
      },
      getMarketPrice: async (id: string) => {
        const raw = redisCache.get(id);
        return raw ? JSON.parse(raw) : null;
      },
      lockOpportunityFingerprint: async (_fp: string, _ttlMs?: number): Promise<boolean> => {
        return true;
      },
    } as unknown as RedisRepository;

    const mockSolanaMonitor = {
      checkHealth: async () => ({
        isHealthy: true,
        cluster: 'devnet',
        endpoint: 'https://api.devnet.solana.com',
        currentSlot: BigInt(250000000),
        latencyMs: 15,
        lastCheckedAt: new Date(),
      }),
    } as unknown as SolanaHealthMonitor;

    // 2. Market Data Polling
    const tokenRegistry = new TokenAndPoolRegistry(mockPrisma);
    await tokenRegistry.refreshRegistry();

    const adapterRegistry = new DexAdapterRegistry();
    const raydiumAdapter = new RaydiumAdapter(config);
    const orcaAdapter = new OrcaAdapter(config);
    adapterRegistry.register(raydiumAdapter);
    adapterRegistry.register(orcaAdapter);

    const raydiumQuote: Quote = {
      poolId: 'raydium-sol-usdc',
      dexId: 'raydium',
      tokenIn: solToken,
      tokenOut: usdcToken,
      inputAmount: BigInt(1000000000),
      expectedOutputAmount: BigInt(180000000),
      price: new Decimal('180.00'),
      feeAmount: BigInt(450000),
      priceImpactPercent: new Decimal('0.0005'),
      estimatedSlippagePercent: new Decimal('0.0010'),
      slot: BigInt(250000100),
      timestamp: new Date(),
    };

    const orcaQuote: Quote = {
      poolId: 'orca-sol-usdc',
      dexId: 'orca',
      tokenIn: solToken,
      tokenOut: usdcToken,
      inputAmount: BigInt(1000000000),
      expectedOutputAmount: BigInt(183000000),
      price: new Decimal('183.00'),
      feeAmount: BigInt(540000),
      priceImpactPercent: new Decimal('0.0005'),
      estimatedSlippagePercent: new Decimal('0.0010'),
      slot: BigInt(250000100),
      timestamp: new Date(),
    };

    // 3. Opportunity Detection & Profitability Calculation
    const profitabilityEngine = new ProfitabilityEngine();
    const riskEngine = new RiskEngine(config);
    const detector = new ArbitrageDetector(profitabilityEngine, riskEngine, mockRedis);

    const calcResult = profitabilityEngine.calculateProfitability({
      buyQuote: raydiumQuote,
      sellQuote: orcaQuote,
      tradeAmountUsd: new Decimal(100),
    });
    expect(calcResult.isProfitable).toBe(true);

    const opportunity = await detector.evaluateBidirectional(pair, raydiumQuote, orcaQuote);
    expect(opportunity).not.toBeNull();
    expect(opportunity?.buyDexId).toBe('raydium');
    expect(opportunity?.sellDexId).toBe('orca');
    expect(opportunity?.netProfitUsd.greaterThan(0)).toBe(true);

    // 4. Simulation & Paper Trade Execution
    const simulator = new TransactionSimulator();
    const paperTrader = new PaperTradingEngine(simulator);

    const paperTrade = await paperTrader.executePaperTrade(opportunity!);
    expect(paperTrade).not.toBeNull();
    expect(paperTrade?.mode).toBe('PAPER');
    expect(paperTrade?.status).toBe('COMPLETED');

    // 5. Performance Aggregation
    const performanceCalc = new PerformanceCalculator();
    const metrics = performanceCalc.calculateMetrics(paperTrader.getTradeHistory());
    expect(metrics.totalPaperTrades).toBe(1);
    expect(metrics.successfulTrades).toBe(1);
    expect(metrics.winRatePercent.toNumber()).toBe(100);

    // 6. Fastify REST API Health & Status Checks
    const apiServer = buildServer({
      config,
      prisma: mockPrisma,
      redis: mockRedis,
      solanaMonitor: mockSolanaMonitor,
    });

    const healthRes = await apiServer.inject({
      method: 'GET',
      url: '/api/v1/health',
    });
    expect(healthRes.statusCode).toBe(200);
    expect(JSON.parse(healthRes.body).status).toBe('ok');

    const statusRes = await apiServer.inject({
      method: 'GET',
      url: '/api/v1/system/status',
    });
    expect(statusRes.statusCode).toBe(200);
    expect(JSON.parse(statusRes.body).tradingMode).toBe('paper');
  });
});
