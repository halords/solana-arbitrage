import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@solana-arbitrage/database';

export interface OpportunityRouteOptions {
  prisma: PrismaClient;
}

export const opportunityRoutes: FastifyPluginAsync<OpportunityRouteOptions> = async (
  fastify: FastifyInstance,
  options: OpportunityRouteOptions
): Promise<void> => {
  fastify.get('/opportunities', async (request) => {
    const query = request.query as { limit?: string; status?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;

    const queryOptions: Parameters<typeof options.prisma.opportunity.findMany>[0] = {
      take: limit,
      orderBy: { detectedAt: 'desc' },
      include: {
        buyDex: true,
        sellDex: true,
        inputToken: true,
        outputToken: true,
      },
    };

    if (query.status) {
      queryOptions.where = { status: query.status };
    }

    return options.prisma.opportunity.findMany(queryOptions);
  });

  fastify.get('/opportunities/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const opportunity = await options.prisma.opportunity.findUnique({
      where: { id },
      include: {
        buyDex: true,
        sellDex: true,
        inputToken: true,
        outputToken: true,
        simulations: true,
        trades: true,
      },
    });

    if (!opportunity) {
      return reply.code(404).send({ error: 'Opportunity not found' });
    }

    return opportunity;
  });

  fastify.post('/opportunities/:id/simulate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const opportunity = await options.prisma.opportunity.findUnique({
      where: { id },
    });

    if (!opportunity) {
      return reply.code(404).send({ error: 'Opportunity not found' });
    }

    return {
      success: true,
      opportunityId: id,
      expectedOutput: opportunity.tradeAmount.add(opportunity.grossProfit).toString(),
      estimatedProfit: opportunity.netProfit.toString(),
      simulatedAt: new Date(),
    };
  });

  fastify.post('/opportunities/:id/paper-trade', async (request, reply) => {
    const { id } = request.params as { id: string };
    const opportunity = await options.prisma.opportunity.findUnique({
      where: { id },
    });

    if (!opportunity) {
      return reply.code(404).send({ error: 'Opportunity not found' });
    }

    // Record paper trade ledger entry (Phase 1 safety: strictly mode = 'PAPER')
    const trade = await options.prisma.trade.create({
      data: {
        opportunityId: id,
        mode: 'PAPER',
        inputAmount: opportunity.tradeAmount,
        expectedOutput: opportunity.tradeAmount.add(opportunity.grossProfit),
        actualOutput: opportunity.tradeAmount.add(opportunity.netProfit),
        expectedProfit: opportunity.grossProfit,
        actualProfit: opportunity.netProfit,
        status: 'COMPLETED',
      },
    });

    return trade;
  });
};
