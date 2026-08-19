import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PrismaClient, RedisRepository } from '@solana-arbitrage/database';

export interface MarketRouteOptions {
  prisma: PrismaClient;
  redis: RedisRepository;
}

export const marketRoutes: FastifyPluginAsync<MarketRouteOptions> = async (
  fastify: FastifyInstance,
  options: MarketRouteOptions
): Promise<void> => {
  fastify.get('/dexes', async () => {
    return options.prisma.dex.findMany({
      orderBy: { name: 'asc' },
    });
  });

  fastify.get('/tokens', async () => {
    return options.prisma.token.findMany({
      orderBy: { symbol: 'asc' },
    });
  });

  fastify.get('/pools', async () => {
    return options.prisma.pool.findMany({
      include: {
        dex: true,
        tokenA: true,
        tokenB: true,
      },
    });
  });
};
