import { describe, it, expect } from 'vitest';
import { MarketDataPoller } from '../src/poller.js';
import { TokenAndPoolRegistry } from '../src/registry.js';
import { DexAdapterRegistry, RaydiumAdapter, OrcaAdapter } from '@solana-arbitrage/dex-adapters';
import { loadConfig } from '@solana-arbitrage/config';
import { PrismaClient, RedisRepository } from '@solana-arbitrage/database';

describe('MarketDataPoller', () => {
  const config = loadConfig({
    RAYDIUM_ENABLED: 'true',
    ORCA_ENABLED: 'true',
  });

  it('should poll quotes from enabled adapters for whitelisted pairs and update cache', async () => {
    const mockPrisma = {
      token: {
        findMany: async () => [
          {
            id: 'sol-id',
            mintAddress: 'So11111111111111111111111111111111111111112',
            symbol: 'SOL',
            name: 'Wrapped SOL',
            decimals: 9,
            enabled: true,
            whitelisted: true,
          },
          {
            id: 'usdc-id',
            mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            enabled: true,
            whitelisted: true,
          },
        ],
      },
    } as unknown as PrismaClient;

    const mockRedis = {
      setMarketPrice: async () => Promise.resolve(),
    } as unknown as RedisRepository;

    const tokenRegistry = new TokenAndPoolRegistry(mockPrisma);
    await tokenRegistry.refreshRegistry();

    const adapterRegistry = new DexAdapterRegistry();
    adapterRegistry.register(new RaydiumAdapter(config));
    adapterRegistry.register(new OrcaAdapter(config));

    const poller = new MarketDataPoller(adapterRegistry, tokenRegistry, mockRedis, mockPrisma);
    const quotes = await poller.pollOnce();

    expect(quotes.length).toBe(2);
    expect(quotes[0]?.dexId).toBe('raydium');
    expect(quotes[1]?.dexId).toBe('orca');
  });
});
