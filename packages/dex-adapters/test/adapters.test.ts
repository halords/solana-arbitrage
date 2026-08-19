import { describe, it, expect } from 'vitest';
import { RaydiumAdapter, OrcaAdapter, DexAdapterRegistry } from '../src/index.js';
import { loadConfig } from '@solana-arbitrage/config';
import { TokenInfo } from '@solana-arbitrage/domain';

describe('DEX Adapters & Registry', () => {
  const config = loadConfig({
    RAYDIUM_ENABLED: 'true',
    ORCA_ENABLED: 'true',
  });

  const solToken: TokenInfo = {
    id: 'sol-id',
    mintAddress: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Wrapped SOL',
    decimals: 9,
    enabled: true,
    whitelisted: true,
  };

  const usdcToken: TokenInfo = {
    id: 'usdc-id',
    mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    enabled: true,
    whitelisted: true,
  };

  it('should register and retrieve enabled adapters', () => {
    const registry = new DexAdapterRegistry();
    const raydium = new RaydiumAdapter(config);
    const orca = new OrcaAdapter(config);

    registry.register(raydium);
    registry.register(orca);

    expect(registry.getAdapter('raydium')).toBeDefined();
    expect(registry.getAdapter('orca')).toBeDefined();
    expect(registry.getEnabledAdapters().length).toBe(2);
  });

  it('should calculate Raydium quote correctly for 1 SOL swap to USDC', async () => {
    const raydium = new RaydiumAdapter(config);
    const quote = await raydium.getQuote({
      poolId: 'raydium-sol-usdc',
      tokenIn: solToken,
      tokenOut: usdcToken,
      amountIn: BigInt(1000000000), // 1 SOL (9 decimals)
    });

    expect(quote.dexId).toBe('raydium');
    expect(quote.price.toString()).toBe('178');
    // 1 SOL * 178.00 USDC = 178.00 USDC gross. 0.25% fee = 0.445 USDC. Net = 177.555 USDC = 177555000 (6 decimals)
    expect(quote.expectedOutputAmount).toBe(BigInt(177555000));
  });

  it('should calculate Orca quote correctly for 1 SOL swap to USDC', async () => {
    const orca = new OrcaAdapter(config);
    const quote = await orca.getQuote({
      poolId: 'orca-sol-usdc',
      tokenIn: solToken,
      tokenOut: usdcToken,
      amountIn: BigInt(1000000000), // 1 SOL
    });

    expect(quote.dexId).toBe('orca');
    expect(quote.price.toString()).toBe('182.5');
    // 1 SOL * 182.50 USDC = 182.50 USDC gross. 0.30% fee = 0.5475 USDC. Net = 181.9525 USDC = 181952500 (6 decimals)
    expect(quote.expectedOutputAmount).toBe(BigInt(181952500));
  });
});
