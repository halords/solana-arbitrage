import { describe, it, expect } from 'vitest';
import { SolanaHealthMonitor } from '../src/health.js';
import { loadConfig } from '@solana-arbitrage/config';
import { Rpc, SolanaRpcApi } from '@solana/kit';

describe('SolanaHealthMonitor', () => {
  const config = loadConfig({
    MAX_RPC_LATENCY_MS: '1500',
    SOLANA_CLUSTER: 'devnet',
    SOLANA_RPC_URL: 'https://api.devnet.solana.com',
  });

  it('should return healthy status when getSlot succeeds within latency threshold', async () => {
    const mockRpc = {
      getSlot: () => ({
        send: async (): Promise<bigint> => BigInt(250000000),
      }),
    } as unknown as Rpc<SolanaRpcApi>;

    const monitor = new SolanaHealthMonitor(mockRpc, config);
    const health = await monitor.checkHealth();

    expect(health.isHealthy).toBe(true);
    expect(health.currentSlot).toBe(BigInt(250000000));
    expect(health.cluster).toBe('devnet');
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('should return unhealthy when RPC throws an error', async () => {
    const mockRpc = {
      getSlot: () => ({
        send: async (): Promise<bigint> => {
          throw new Error('Connection refused');
        },
      }),
    } as unknown as Rpc<SolanaRpcApi>;

    const monitor = new SolanaHealthMonitor(mockRpc, config);
    const health = await monitor.checkHealth();

    expect(health.isHealthy).toBe(false);
    expect(health.currentSlot).toBe(BigInt(0));
    expect(health.error).toContain('Connection refused');
  });
});
