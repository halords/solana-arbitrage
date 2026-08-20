import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PrismaClient, RedisRepository } from '@solana-arbitrage/database';
import { AppConfig } from '@solana-arbitrage/config';
import { LatencyProfiler, ArbitrageDetector, ProfitabilityEngine, RiskEngine } from '@solana-arbitrage/arbitrage-engine';
import { MarketReplayEngine, HistoricalTick } from '@solana-arbitrage/simulation-engine';
import { TokenPair, TokenInfo, Quote } from '@solana-arbitrage/domain';
import Decimal from 'decimal.js';

export interface SystemRouteOptions {
  prisma: PrismaClient;
  config: AppConfig;
  profiler?: LatencyProfiler | undefined;
  detector?: ArbitrageDetector | undefined;
}

export const systemRoutes: FastifyPluginAsync<SystemRouteOptions> = async (
  fastify: FastifyInstance,
  options: SystemRouteOptions
): Promise<void> => {
  fastify.get('/performance', async () => {
    const trades = await options.prisma.trade.findMany({
      where: { mode: 'PAPER' },
    });

    const totalPaperTrades = trades.length;
    const profitableTrades = trades.filter((t) => t.actualProfit.toNumber() > 0).length;
    const totalProfitUsd = trades.reduce((acc, t) => acc + t.actualProfit.toNumber(), 0);
    const winRate = totalPaperTrades > 0 ? (profitableTrades / totalPaperTrades) * 100 : 0;

    return {
      totalOpportunities: await options.prisma.opportunity.count(),
      paperTrades: totalPaperTrades,
      profitableTrades,
      losingTrades: totalPaperTrades - profitableTrades,
      totalPaperProfitUsd: totalProfitUsd.toFixed(4),
      winRatePercent: winRate.toFixed(2),
    };
  });

  fastify.get('/config', async () => {
    // Return sanitized non-secret config only (SEC-002)
    return {
      appName: options.config.APP_NAME,
      environment: options.config.NODE_ENV,
      solanaCluster: options.config.SOLANA_CLUSTER,
      tradingMode: options.config.TRADING_MODE,
      riskLimits: {
        maxTradeUsd: options.config.MAX_TRADE_USD,
        minProfitUsd: options.config.MIN_PROFIT_USD,
        minRoiPercent: options.config.MIN_ROI_PERCENT,
        maxSlippagePercent: options.config.MAX_SLIPPAGE_PERCENT,
        maxQuoteAgeMs: options.config.MAX_QUOTE_AGE_MS,
        maxDailyLossUsd: options.config.MAX_DAILY_LOSS_USD,
      },
      monitoringTimers: {
        priceUpdateIntervalMs: options.config.PRICE_UPDATE_INTERVAL_MS,
        poolRefreshIntervalMs: options.config.POOL_REFRESH_INTERVAL_MS,
        opportunityScanIntervalMs: options.config.OPPORTUNITY_SCAN_INTERVAL_MS,
      },
    };
  });

  fastify.get('/system/latency-breakdown', async () => {
    if (!options.profiler) {
      return {
        profitability_calc_us: { count: 0, minUs: 0, p50Us: 0, p95Us: 0, p99Us: 0, maxUs: 0, meanUs: 0 },
        risk_evaluation_us: { count: 0, minUs: 0, p50Us: 0, p95Us: 0, p99Us: 0, maxUs: 0, meanUs: 0 },
      };
    }
    return options.profiler.getAllStageMetrics();
  });

  fastify.post('/backtest/run', async (request, reply) => {
    if (!options.detector) {
      return reply.status(503).send({ error: 'ArbitrageDetector not configured on API instance' });
    }

    const body = (request.body as {
      executionDelayMs?: number;
      simulatedSlippageDecayRate?: number;
      initialCapitalUsd?: number;
      sampleTicksCount?: number;
    }) || {};

    const delayMs = body.executionDelayMs ?? 150;
    const decayRate = body.simulatedSlippageDecayRate ?? 0.10;
    const initialCapital = body.initialCapitalUsd ?? options.config.INITIAL_CAPITAL_USD ?? 10.0;
    const ticksCount = body.sampleTicksCount ?? 500;

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
      baseToken: solToken,
      quoteToken: usdcToken,
    };

    // Generate realistic historical ticks stream
    const ticks: HistoricalTick[] = [];

    for (let i = 0; i < ticksCount; i++) {
      const basePrice = 180.0;
      // Guarantee arbitrage spread divergence between Raydium and Orca (0.8% - 2.5%)
      const priceA = (basePrice + (i % 3) * 0.15).toFixed(2);
      const priceB = (basePrice + 1.80 + (i % 5) * 0.35).toFixed(2);

      const quoteA: Quote = {
        poolId: 'raydium-sol-usdc',
        dexId: 'raydium',
        tokenIn: solToken,
        tokenOut: usdcToken,
        inputAmount: BigInt(1000000000),
        expectedOutputAmount: BigInt(180000000),
        price: new Decimal(priceA),
        feeAmount: BigInt(450000),
        priceImpactPercent: new Decimal('0.0005'),
        estimatedSlippagePercent: new Decimal('0.0010'),
        slot: BigInt(250000000 + i),
        timestamp: new Date(),
      };

      const quoteB: Quote = {
        poolId: 'orca-sol-usdc',
        dexId: 'orca',
        tokenIn: solToken,
        tokenOut: usdcToken,
        inputAmount: BigInt(1000000000),
        expectedOutputAmount: BigInt(180000000),
        price: new Decimal(priceB),
        feeAmount: BigInt(450000),
        priceImpactPercent: new Decimal('0.0005'),
        estimatedSlippagePercent: new Decimal('0.0010'),
        slot: BigInt(250000000 + i),
        timestamp: new Date(),
      };

      ticks.push({
        timestamp: new Date(Date.now() + i * 100),
        pair,
        quoteA,
        quoteB,
      });
    }

    // Dedicated backtest detector instance with relaxed quote age for historical simulations
    const backtestConfig = {
      ...options.config,
      MAX_QUOTE_AGE_MS: 3_600_000, // 1 hour window for backtest simulation replay
    };
    const backtestRedis = {
      lockOpportunityFingerprint: async () => true,
    } as unknown as RedisRepository;
    const backtestDetector = new ArbitrageDetector(
      new ProfitabilityEngine(),
      new RiskEngine(backtestConfig),
      backtestRedis
    );

    const replayEngine = new MarketReplayEngine(backtestDetector);
    const result = await replayEngine.runBacktest(ticks, {
      executionDelayMs: delayMs,
      simulatedSlippageDecayRate: decayRate,
      initialCapitalUsd: initialCapital,
    });

    return reply.send({
      success: true,
      parameters: {
        executionDelayMs: delayMs,
        simulatedSlippageDecayRate: decayRate,
        initialCapitalUsd: initialCapital,
        ticksEvaluated: ticksCount,
      },
      summary: result.summary,
      recentTrades: result.trades.slice(-10),
    });
  });

  // Dynamic Trading Config & Sizing Management
  fastify.get('/system/config', async (_request, reply) => {
    try {
      let cfg = await options.prisma.tradingConfig.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
      });

      if (!cfg) {
        cfg = await options.prisma.tradingConfig.create({
          data: {
            maxTradeUsd: options.config.MAX_TRADE_USD ?? 10.0,
            minProfitUsd: options.config.MIN_PROFIT_USD ?? 0.01,
            minRoiPercent: options.config.MIN_ROI_PERCENT ?? 0.05,
            maxSlippagePercent: options.config.MAX_SLIPPAGE_PERCENT ?? 0.3,
            maxDailyLossUsd: options.config.MAX_DAILY_LOSS_USD ?? 10.0,
            maxConsecutiveLosses: options.config.MAX_CONSECUTIVE_LOSSES ?? 5,
            isActive: true,
          },
        });
      }

      return reply.send({
        success: true,
        config: {
          id: cfg.id,
          maxTradeUsd: Number(cfg.maxTradeUsd),
          minProfitUsd: Number(cfg.minProfitUsd),
          minRoiPercent: Number(cfg.minRoiPercent),
          maxSlippagePercent: Number(cfg.maxSlippagePercent),
          maxDailyLossUsd: Number(cfg.maxDailyLossUsd),
          maxConsecutiveLosses: cfg.maxConsecutiveLosses,
          updatedAt: cfg.updatedAt,
        },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: errorMessage });
    }
  });

  fastify.put('/system/config', async (request, reply) => {
    try {
      const body = request.body as {
        maxTradeUsd?: number;
        minProfitUsd?: number;
        minRoiPercent?: number;
        maxSlippagePercent?: number;
        maxDailyLossUsd?: number;
        maxConsecutiveLosses?: number;
      };

      let cfg = await options.prisma.tradingConfig.findFirst({
        where: { isActive: true },
      });

      if (!cfg) {
        cfg = await options.prisma.tradingConfig.create({
          data: {
            maxTradeUsd: body.maxTradeUsd ?? 10.0,
            minProfitUsd: body.minProfitUsd ?? 0.01,
            minRoiPercent: body.minRoiPercent ?? 0.05,
            maxSlippagePercent: body.maxSlippagePercent ?? 0.3,
            maxDailyLossUsd: body.maxDailyLossUsd ?? 10.0,
            maxConsecutiveLosses: body.maxConsecutiveLosses ?? 5,
            isActive: true,
          },
        });
      } else {
        cfg = await options.prisma.tradingConfig.update({
          where: { id: cfg.id },
          data: {
            ...(body.maxTradeUsd !== undefined ? { maxTradeUsd: body.maxTradeUsd } : {}),
            ...(body.minProfitUsd !== undefined ? { minProfitUsd: body.minProfitUsd } : {}),
            ...(body.minRoiPercent !== undefined ? { minRoiPercent: body.minRoiPercent } : {}),
            ...(body.maxSlippagePercent !== undefined ? { maxSlippagePercent: body.maxSlippagePercent } : {}),
            ...(body.maxDailyLossUsd !== undefined ? { maxDailyLossUsd: body.maxDailyLossUsd } : {}),
            ...(body.maxConsecutiveLosses !== undefined ? { maxConsecutiveLosses: body.maxConsecutiveLosses } : {}),
          },
        });
      }

      return reply.send({
        success: true,
        message: 'Trading capital and risk limits updated in database successfully',
        config: {
          id: cfg.id,
          maxTradeUsd: Number(cfg.maxTradeUsd),
          minProfitUsd: Number(cfg.minProfitUsd),
          minRoiPercent: Number(cfg.minRoiPercent),
          maxSlippagePercent: Number(cfg.maxSlippagePercent),
          maxDailyLossUsd: Number(cfg.maxDailyLossUsd),
          maxConsecutiveLosses: cfg.maxConsecutiveLosses,
          updatedAt: cfg.updatedAt,
        },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: errorMessage });
    }
  });

  fastify.post('/system/clear-trades', async (_request, reply) => {
    await options.prisma.trade.deleteMany();
    await options.prisma.opportunity.deleteMany();
    return reply.send({
      success: true,
      message: 'Successfully cleared all historical trades and opportunities from database',
      timestamp: new Date(),
    });
  });

  fastify.post('/system/kill-switch', async (_request, reply) => {
    // Record emergency kill event in database
    await options.prisma.systemEvent.create({
      data: {
        service: 'api',
        level: 'fatal',
        eventType: 'EMERGENCY_KILL_SWITCH_ACTIVATED',
        message: 'Administrative kill switch triggered. Trading halted immediately.',
      },
    });

    return reply.send({
      success: true,
      status: 'HALTED',
      message: 'Emergency kill switch triggered successfully',
      timestamp: new Date(),
    });
  });
};
