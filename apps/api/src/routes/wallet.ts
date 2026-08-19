import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AppConfig } from '@solana-arbitrage/config';
import { MainnetWalletManager, CircuitBreaker, EmergencyDrainService } from '@solana-arbitrage/solana';
import { Rpc, SolanaRpcApi } from '@solana/kit';

export interface WalletRouteOptions {
  config: AppConfig;
  walletManager?: MainnetWalletManager | undefined;
  circuitBreaker?: CircuitBreaker | undefined;
  drainService?: EmergencyDrainService | undefined;
  rpc?: Rpc<SolanaRpcApi> | undefined;
}

export const walletRoutes: FastifyPluginAsync<WalletRouteOptions> = async (
  fastify: FastifyInstance,
  options: WalletRouteOptions
): Promise<void> => {
  fastify.get('/wallet/balance', async (_request, reply) => {
    if (!options.walletManager || !options.rpc) {
      return reply.send({
        available: false,
        reason: 'Mainnet wallet not configured (TRADING_MODE=paper)',
        address: null,
        sol: 0,
        hasSufficientFunds: false,
      });
    }

    try {
      const balance = await options.walletManager.getBalance(options.rpc);
      return reply.send({
        available: true,
        address: balance.address,
        lamports: balance.lamports.toString(),
        sol: balance.sol,
        hasSufficientFunds: balance.hasSufficientFunds,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({
        available: false,
        reason: errorMessage,
        address: null,
        sol: 0,
        hasSufficientFunds: false,
      });
    }
  });

  fastify.get('/wallet/circuit-breaker', async (_request, reply) => {
    if (!options.circuitBreaker) {
      return reply.send({
        available: false,
        reason: 'Circuit breaker not configured',
        state: null,
      });
    }

    return reply.send({
      available: true,
      state: options.circuitBreaker.getState(),
    });
  });

  fastify.post('/wallet/circuit-breaker/reset', async (_request, reply) => {
    if (!options.circuitBreaker) {
      return reply.status(503).send({ error: 'Circuit breaker not configured' });
    }

    options.circuitBreaker.reset();
    return reply.send({
      success: true,
      message: 'Circuit breaker reset successfully',
      state: options.circuitBreaker.getState(),
    });
  });

  fastify.post('/system/emergency-drain', async (_request, reply) => {
    if (!options.drainService || !options.walletManager || !options.rpc) {
      return reply.status(503).send({
        error: 'Emergency drain not available (mainnet wallet not configured)',
      });
    }

    const coldStorage = options.walletManager.getColdStorageAddress();
    if (!coldStorage) {
      return reply.status(400).send({
        error: 'COLD_STORAGE_ADDRESS not configured in environment',
      });
    }

    const signer = options.walletManager.getSigner();
    const result = await options.drainService.buildDrainTransaction(
      options.rpc,
      signer,
      coldStorage
    );

    if (!result.success) {
      return reply.status(500).send({
        success: false,
        error: result.error,
      });
    }

    // In a real execution, we would broadcast here.
    // For now, return the constructed transaction details.
    return reply.send({
      success: true,
      drain: {
        amountSol: result.amountSol,
        amountLamports: result.amountLamports.toString(),
        destinationAddress: result.destinationAddress,
        transactionReady: true,
      },
    });
  });
};
