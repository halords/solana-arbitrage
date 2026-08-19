import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PrismaClient, checkDatabaseHealth, RedisRepository } from '@solana-arbitrage/database';
import { SolanaHealthMonitor } from '@solana-arbitrage/solana';
import { AppConfig } from '@solana-arbitrage/config';

export interface HealthRouteOptions {
  prisma: PrismaClient;
  redis: RedisRepository;
  solanaMonitor: SolanaHealthMonitor;
  config: AppConfig;
  startTime: number;
}

export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (
  fastify: FastifyInstance,
  options: HealthRouteOptions
): Promise<void> => {
  fastify.get('/health', async () => {
    const [dbHealth, redisHealth, solanaHealth] = await Promise.all([
      checkDatabaseHealth(options.prisma),
      options.redis.checkHealth(),
      options.solanaMonitor.checkHealth(),
    ]);

    const isHealthy =
      dbHealth.isHealthy && redisHealth.isHealthy && solanaHealth.isHealthy;

    return {
      status: isHealthy ? 'ok' : 'degraded',
      database: dbHealth.isHealthy ? 'ok' : 'error',
      redis: redisHealth.isHealthy ? 'ok' : 'error',
      solana_rpc: solanaHealth.isHealthy ? 'ok' : 'error',
      latency: {
        databaseMs: dbHealth.latencyMs,
        redisMs: redisHealth.latencyMs,
        solanaRpcMs: solanaHealth.latencyMs,
      },
    };
  });

  fastify.get('/system/status', async () => {
    const solanaHealth = await options.solanaMonitor.checkHealth();
    const uptimeSeconds = Math.floor((Date.now() - options.startTime) / 1000);

    return {
      botStatus: 'RUNNING',
      tradingMode: options.config.TRADING_MODE,
      solanaCluster: options.config.SOLANA_CLUSTER,
      rpcStatus: solanaHealth.isHealthy ? 'HEALTHY' : 'UNHEALTHY',
      currentSlot: solanaHealth.currentSlot.toString(),
      uptimeSeconds,
    };
  });
};
