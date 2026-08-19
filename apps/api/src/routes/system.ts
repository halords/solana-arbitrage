import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@solana-arbitrage/database';
import { AppConfig } from '@solana-arbitrage/config';
import { LatencyProfiler } from '@solana-arbitrage/arbitrage-engine';

export interface SystemRouteOptions {
  prisma: PrismaClient;
  config: AppConfig;
  profiler?: LatencyProfiler | undefined;
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
