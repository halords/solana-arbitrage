import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { AppConfig } from '@solana-arbitrage/config';
import { PrismaClient, RedisRepository } from '@solana-arbitrage/database';
import { SolanaHealthMonitor } from '@solana-arbitrage/solana';
import { LatencyProfiler } from '@solana-arbitrage/arbitrage-engine';
import { healthRoutes } from './routes/health.js';
import { marketRoutes } from './routes/market.js';
import { opportunityRoutes } from './routes/opportunities.js';
import { systemRoutes } from './routes/system.js';

export interface BuildServerOptions {
  config: AppConfig;
  prisma: PrismaClient;
  redis: RedisRepository;
  solanaMonitor: SolanaHealthMonitor;
  profiler?: LatencyProfiler;
}

export function buildServer(options: BuildServerOptions): FastifyInstance {
  const server = Fastify({
    logger: false, // central logging handled via @solana-arbitrage/logging
  });

  const startTime = Date.now();

  // Security plugins
  void server.register(cors, { origin: true });
  void server.register(helmet, { contentSecurityPolicy: false });
  void server.register(rateLimit, {
    max: options.config.API_RATE_LIMIT,
    timeWindow: '1 minute',
  });

  // API v1 route prefix
  void server.register(
    async (v1) => {
      void v1.register(healthRoutes, {
        prisma: options.prisma,
        redis: options.redis,
        solanaMonitor: options.solanaMonitor,
        config: options.config,
        startTime,
      });

      void v1.register(marketRoutes, {
        prisma: options.prisma,
        redis: options.redis,
      });

      void v1.register(opportunityRoutes, {
        prisma: options.prisma,
      });

      void v1.register(systemRoutes, {
        prisma: options.prisma,
        config: options.config,
        profiler: options.profiler,
      });
    },
    { prefix: '/api/v1' }
  );

  return server;
}
