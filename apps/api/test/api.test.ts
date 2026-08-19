import { describe, it, expect } from 'vitest';
import { buildServer } from '../src/server.js';
import { loadConfig } from '@solana-arbitrage/config';
import { PrismaClient, RedisRepository } from '@solana-arbitrage/database';
import { SolanaHealthMonitor } from '@solana-arbitrage/solana';

describe('Fastify REST API Integration', () => {
  const config = loadConfig({
    API_RATE_LIMIT: '1000',
    TRADING_MODE: 'paper',
  });

  const mockPrisma = {
    $queryRaw: async () => [{ '?column?': 1 }],
    dex: { findMany: async () => [] },
    token: { findMany: async () => [] },
    pool: { findMany: async () => [] },
    opportunity: { count: async () => 0, findMany: async () => [] },
    trade: { findMany: async () => [] },
    systemEvent: { create: async () => ({ id: BigInt(1) }) },
  } as unknown as PrismaClient;

  const mockRedis = {
    checkHealth: async () => ({ isHealthy: true, latencyMs: 1, lastCheckedAt: new Date() }),
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

  const server = buildServer({
    config,
    prisma: mockPrisma,
    redis: mockRedis,
    solanaMonitor: mockSolanaMonitor,
  });

  it('should return 200 OK for GET /api/v1/health', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.database).toBe('ok');
    expect(body.redis).toBe('ok');
    expect(body.solana_rpc).toBe('ok');
  });

  it('should return 200 OK for GET /api/v1/system/status', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/system/status',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.botStatus).toBe('RUNNING');
    expect(body.tradingMode).toBe('paper');
  });

  it('should return sanitized config for GET /api/v1/config without leaking secrets', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/config',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.tradingMode).toBe('paper');
    expect(body.JWT_SECRET).toBeUndefined();
    expect(body.DATABASE_PASSWORD).toBeUndefined();
  });

  it('should activate kill-switch on POST /api/v1/system/kill-switch', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/system/kill-switch',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('HALTED');
  });
});
