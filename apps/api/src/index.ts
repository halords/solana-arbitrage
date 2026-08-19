import { loadConfig } from '@solana-arbitrage/config';
import { createLogger } from '@solana-arbitrage/logging';
import { PrismaClient, RedisRepository, checkDatabaseHealth } from '@solana-arbitrage/database';
import { createSolanaConnection, SolanaHealthMonitor, SolanaSubscriptionManager } from '@solana-arbitrage/solana';
import { DexAdapterRegistry, RaydiumAdapter, OrcaAdapter } from '@solana-arbitrage/dex-adapters';
import { TokenAndPoolRegistry, MarketDataPoller } from '@solana-arbitrage/market-data';
import { ProfitabilityEngine, RiskEngine, ArbitrageDetector } from '@solana-arbitrage/arbitrage-engine';
import { TransactionSimulator, PaperTradingEngine, PerformanceCalculator } from '@solana-arbitrage/simulation-engine';
import { buildServer } from './server.js';
import { Slot } from '@solana/kit';

export * from './server.js';

const logger = createLogger('solana-arbitrage-runner');

async function main(): Promise<void> {
  logger.info('Initializing Solana Arbitrage Platform (Paper Trading Mode)...');
  const config = loadConfig();

  // 1. Initialize DB & Redis
  const prisma = new PrismaClient();
  const redisRepo = new RedisRepository(config, logger);

  // Health check database
  const dbHealth = await checkDatabaseHealth(prisma);
  if (dbHealth.isHealthy) {
    logger.info({ latencyMs: dbHealth.latencyMs }, 'Database connected and healthy');
  } else {
    logger.warn({ error: dbHealth.error }, 'Database connection degraded, proceeding in resilient fallback mode');
  }

  // 2. Initialize Solana Client & Monitor
  const solanaBundle = createSolanaConnection(config);
  const solanaMonitor = new SolanaHealthMonitor(solanaBundle.rpc, config, logger);
  const subscriptionService = new SolanaSubscriptionManager(solanaBundle.rpcSubscriptions, logger);

  // Start slot stream listener
  void subscriptionService.subscribeToSlots((slot: Slot) => {
    logger.debug({ slot: slot.toString() }, 'Solana slot tick');
  });

  // 3. Register DEX Adapters & Whitelisted Tokens
  const adapterRegistry = new DexAdapterRegistry();
  const raydiumAdapter = new RaydiumAdapter(config, logger);
  const orcaAdapter = new OrcaAdapter(config, logger);
  adapterRegistry.register(raydiumAdapter);
  adapterRegistry.register(orcaAdapter);

  const tokenRegistry = new TokenAndPoolRegistry(prisma, logger);
  await tokenRegistry.refreshRegistry();

  // 4. Initialize Arbitrage & Simulation Engines
  const profitabilityEngine = new ProfitabilityEngine();
  const riskEngine = new RiskEngine(config);
  const detector = new ArbitrageDetector(profitabilityEngine, riskEngine, redisRepo, logger);
  const simulator = new TransactionSimulator();
  const paperTrader = new PaperTradingEngine(simulator, logger);
  const performanceCalc = new PerformanceCalculator();

  // 5. Poller Loop with Opportunity Detection & Paper Execution
  const poller = new MarketDataPoller(adapterRegistry, tokenRegistry, redisRepo, prisma, logger);

  // Interval loop: every 500ms poll and scan for arbitrage
  const scanInterval = setInterval(async () => {
    try {
      const quotes = await poller.pollOnce();
      const pairs = tokenRegistry.getTradingPairs();

      for (const pair of pairs) {
        const rayQuote = quotes.find((q) => q.dexId === 'raydium' && q.tokenIn.symbol === pair.baseToken.symbol);
        const orcaQuote = quotes.find((q) => q.dexId === 'orca' && q.tokenIn.symbol === pair.baseToken.symbol);

        if (rayQuote && orcaQuote) {
          const opportunity = await detector.evaluateBidirectional(pair, rayQuote, orcaQuote);
          if (opportunity) {
            logger.info(
              {
                id: opportunity.id,
                buyDex: opportunity.buyDexId,
                sellDex: opportunity.sellDexId,
                profitUsd: opportunity.netProfitUsd.toFixed(4),
              },
              '🎯 Qualified Arbitrage Opportunity Detected'
            );

            // 1. Persist Opportunity to Database
            const buyDexEntity = await prisma.dex.findFirst({ where: { adapterName: opportunity.buyDexId } });
            const sellDexEntity = await prisma.dex.findFirst({ where: { adapterName: opportunity.sellDexId } });
            const inTokenEntity = await prisma.token.findFirst({ where: { symbol: pair.baseToken.symbol } });
            const outTokenEntity = await prisma.token.findFirst({ where: { symbol: pair.quoteToken.symbol } });

            if (buyDexEntity && sellDexEntity && inTokenEntity && outTokenEntity) {
              const oppData = {
                fingerprint: opportunity.fingerprint,
                buyDexId: buyDexEntity.id,
                sellDexId: sellDexEntity.id,
                inputTokenId: inTokenEntity.id,
                outputTokenId: outTokenEntity.id,
                tradeAmount: opportunity.tradeAmountUsd,
                grossProfit: opportunity.grossProfitUsd,
                dexFees: opportunity.dexFeesUsd,
                networkFees: opportunity.networkFeesUsd,
                priorityFees: opportunity.priorityFeesUsd,
                slippageCost: opportunity.slippageCostUsd,
                priceImpact: opportunity.priceImpactUsd,
                safetyBuffer: opportunity.safetyBufferUsd,
                netProfit: opportunity.netProfitUsd,
                roi: opportunity.roiPercent,
                status: 'DETECTED',
                detectedAt: opportunity.detectedAt,
                expiresAt: opportunity.expiresAt,
              };

              const persistedOpp = await prisma.opportunity.upsert({
                where: { fingerprint: opportunity.fingerprint },
                update: {
                  netProfit: opportunity.netProfitUsd,
                  roi: opportunity.roiPercent,
                  expiresAt: opportunity.expiresAt,
                },
                create: {
                  id: opportunity.id,
                  ...oppData,
                },
              });

              // 2. Execute Paper Trade and Persist to Ledger
              const paperTrade = await paperTrader.executePaperTrade(opportunity);
              if (paperTrade) {
                await prisma.trade.create({
                  data: {
                    opportunityId: persistedOpp.id,
                    mode: 'PAPER',
                    inputAmount: paperTrade.inputAmountUsd,
                    expectedOutput: paperTrade.expectedOutputUsd,
                    actualOutput: paperTrade.actualOutputUsd,
                    expectedProfit: paperTrade.expectedProfitUsd,
                    actualProfit: paperTrade.actualProfitUsd,
                    status: paperTrade.status,
                  },
                });

                const metrics = performanceCalc.calculateMetrics(paperTrader.getTradeHistory());
                logger.info(
                  {
                    tradeId: paperTrade.id,
                    totalPaperTrades: metrics.totalPaperTrades,
                    winRate: `${metrics.winRatePercent.toFixed(1)}%`,
                    totalNetProfit: `$${metrics.totalNetProfitUsd.toFixed(4)}`,
                  },
                  '📈 Paper Trade Executed & Persisted'
                );
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      logger.error({ err }, 'Error in market scanning loop');
    }
  }, config.PRICE_UPDATE_INTERVAL_MS || 500);

  // 6. Start Fastify REST API & Dashboard Support Server
  const server = buildServer({
    config,
    prisma,
    redis: redisRepo,
    solanaMonitor,
  });

  const port = config.APP_PORT || 3000;
  await server.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, `🚀 Solana Arbitrage API & Core Service running on http://localhost:${port}`);

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down Solana Arbitrage Platform...');
    clearInterval(scanInterval);
    subscriptionService.unsubscribe();
    await server.close();
    await prisma.$disconnect();
    await redisRepo.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

void main();
