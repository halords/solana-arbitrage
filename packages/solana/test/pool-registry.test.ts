import { describe, it, expect, vi } from 'vitest';
import { MainnetPoolRegistry } from '@solana-arbitrage/solana';
import { Address, Rpc, SolanaRpcApi } from '@solana/kit';

describe('MainnetPoolRegistry', () => {
  it('should initialize with verified Raydium and Orca SOL/USDC pools', () => {
    const registry = new MainnetPoolRegistry();
    const pools = registry.getAllPools();
    expect(pools.length).toBeGreaterThanOrEqual(2);

    const raydiumPools = registry.getPoolsByDex('raydium');
    expect(raydiumPools.length).toBe(1);
    expect(raydiumPools[0]?.pairLabel).toBe('SOL/USDC');

    const orcaPools = registry.getPoolsByDex('orca');
    expect(orcaPools.length).toBe(1);
    expect(orcaPools[0]?.pairLabel).toBe('SOL/USDC');
  });

  it('should retrieve pools by pair symbols', () => {
    const registry = new MainnetPoolRegistry();
    const pools = registry.getPoolsByPair('SOL', 'USDC');
    expect(pools.length).toBe(2);
  });

  it('should verify pool existence through RPC check', async () => {
    const registry = new MainnetPoolRegistry();
    const mockRpc = {
      getAccountInfo: vi.fn().mockReturnValue({
        send: vi.fn().mockResolvedValue({
          value: {
            data: ['dGVzdGRhdGE=', 'base64'],
          },
        }),
      }),
    };

    const exists = await registry.verifyPoolExists(
      mockRpc as unknown as Rpc<SolanaRpcApi>,
      '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2' as Address
    );
    expect(exists).toBe(true);

    const data = await registry.fetchPoolAccountData(
      mockRpc as unknown as Rpc<SolanaRpcApi>,
      '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2' as Address
    );
    expect(data).toBeInstanceOf(Uint8Array);
  });
});
