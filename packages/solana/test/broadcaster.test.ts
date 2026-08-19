import { describe, it, expect } from 'vitest';
import { TransactionBroadcaster } from '../src/broadcaster.js';
import { Rpc, SolanaRpcApi } from '@solana/kit';

describe('TransactionBroadcaster', () => {
  const mockRpc = {} as unknown as Rpc<SolanaRpcApi>;
  const broadcaster = new TransactionBroadcaster(mockRpc);

  it('should broadcast serialized transaction bytes and return confirmation metrics', async () => {
    const dummyBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const result = await broadcaster.broadcastAndConfirm(dummyBytes);

    expect(result).toBeDefined();
    expect(result.status).toBe('CONFIRMED');
    expect(result.signature).toBeDefined();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.submittedAt).toBeInstanceOf(Date);
  });
});
