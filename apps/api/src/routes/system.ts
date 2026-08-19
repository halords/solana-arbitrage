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
      // Realistic DEX price divergence waves (0.5% - 2.5% spread variation)
      const raydiumOffset = Math.sin(i / 6) * 1.85;
      const orcaOffset = Math.cos(i / 5) * 2.20;

      const priceA = (basePrice + raydiumOffset).toFixed(4);
      const priceB = (basePrice + orcaOffset).toFixed(4);

      const quoteA: Quote = {
        poolId: 'raydium-sol-usdc',
        dexId: 'raydium',
        tokenIn: solToken,
        tokenOut: usdcToken,
        inputAmount: BigInt(1000000000),
        expectedOutputAmount: BigInt(180000000),
        price: new Decimal(priceA),
        feeAmount: BigInt(250000),
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
        feeAmount: BigInt(300000),
        priceImpactPercent: new Decimal('0.0005'),
        estimatedSlippagePercent: new Decimal('0.0010'),
        slot: BigInt(250000000 + i),
        timestamp: new Date(),
      };

      ticks.push({
        timestamp: quoteA.timestamp,
        pair,
        quoteA,
        quoteB,
      });
    }

    // Dedicated backtest detector instance to bypass live Redis deduplication locks
    const backtestRedis = {
      lockOpportunityFingerprint: async () => true,
    } as unknown as RedisRepository;
    const backtestDetector = new ArbitrageDetector(
      new ProfitabilityEngine(),
      new RiskEngine(options.config),
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
