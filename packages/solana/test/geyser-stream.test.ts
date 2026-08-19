import { describe, it, expect, vi } from 'vitest';
import { GeyserStreamManager } from '@solana-arbitrage/solana';
import { Address } from '@solana/kit';

describe('GeyserStreamManager', () => {
  it('should manage subscriptions and deliver high-frequency account updates', () => {
    const manager = new GeyserStreamManager();
    const mockPool = '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2' as Address;
    const handler = vi.fn();

    manager.subscribeToAccount(mockPool, handler);
    manager.start();
    expect(manager.getIsStreaming()).toBe(true);

    manager.handleIncomingUpdate({
      accountAddress: mockPool,
      slot: BigInt(250000200),
      data: new Uint8Array([1, 2, 3]),
      writeVersion: BigInt(1),
      timestamp: Date.now(),
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        accountAddress: mockPool,
        slot: BigInt(250000200),
      })
    );

    manager.stop();
    expect(manager.getIsStreaming()).toBe(false);
  });
});
