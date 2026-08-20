import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AppConfig } from '@solana-arbitrage/config';
import { MainnetWalletManager, CircuitBreaker, EmergencyDrainService } from '@solana-arbitrage/solana';
import { PrismaClient } from '@solana-arbitrage/database';
import { Rpc, SolanaRpcApi, Address } from '@solana/kit';

export interface WalletRouteOptions {
  config: AppConfig;
  prisma: PrismaClient;
  walletManager?: MainnetWalletManager | undefined;
  circuitBreaker?: CircuitBreaker | undefined;
  drainService?: EmergencyDrainService | undefined;
  rpc?: Rpc<SolanaRpcApi> | undefined;
}

export const walletRoutes: FastifyPluginAsync<WalletRouteOptions> = async (
  fastify: FastifyInstance,
  options: WalletRouteOptions
): Promise<void> => {
  // 1. Live Hot Wallet Balance
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

  // 2. Circuit Breaker Controls
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

  // 3. Cold Storage Wallets CRUD
  fastify.get('/wallet/cold-storage', async (_request, reply) => {
    try {
      const wallets = await options.prisma.coldStorageWallet.findMany({
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });

      // Fallback: If table is empty, auto-seed with environment or default cold storage
      if (wallets.length === 0) {
        const defaultAddress = options.config.COLD_STORAGE_ADDRESS || '4E1rPQ7iiDXLJn45N9g7brTmw3tmRHr2sRkPosnmzQSH';
        const defaultWallet = await options.prisma.coldStorageWallet.create({
          data: {
            label: 'Main Phantom Cold Vault',
            address: defaultAddress,
            isDefault: true,
            isActive: true,
          },
        });
        return reply.send({ success: true, wallets: [defaultWallet] });
      }

      return reply.send({ success: true, wallets });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: errorMessage });
    }
  });

  fastify.post('/wallet/cold-storage', async (request, reply) => {
    try {
      const body = request.body as { label?: string; address?: string; isDefault?: boolean };
      if (!body.label || !body.address) {
        return reply.status(400).send({ success: false, error: 'Label and Solana Address are required' });
      }

      if (body.isDefault) {
        // Unset previous defaults
        await options.prisma.coldStorageWallet.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      const wallet = await options.prisma.coldStorageWallet.create({
        data: {
          label: body.label,
          address: body.address.trim(),
          isDefault: body.isDefault ?? false,
          isActive: true,
        },
      });

      return reply.status(201).send({ success: true, wallet });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: errorMessage });
    }
  });

  fastify.put('/wallet/cold-storage/:id/default', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Set all to false first
      await options.prisma.coldStorageWallet.updateMany({
        data: { isDefault: false },
      });

      // Set target to true
      const updated = await options.prisma.coldStorageWallet.update({
        where: { id },
        data: { isDefault: true },
      });

      return reply.send({ success: true, wallet: updated });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: errorMessage });
    }
  });

  fastify.delete('/wallet/cold-storage/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await options.prisma.coldStorageWallet.update({
        where: { id },
        data: { isActive: false, isDefault: false },
      });

      return reply.send({ success: true, message: 'Wallet removed' });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: errorMessage });
    }
  });

  // 4. Dynamic Emergency Drain to Selected Default Cold Storage
  fastify.post('/system/emergency-drain', async (_request, reply) => {
    if (!options.drainService || !options.walletManager || !options.rpc) {
      return reply.status(503).send({
        error: 'Emergency drain not available (mainnet wallet not configured)',
      });
    }

    // Lookup active default cold storage from database first, fallback to .env
    let destinationAddress = options.walletManager.getColdStorageAddress();
    try {
      const defaultCold = await options.prisma.coldStorageWallet.findFirst({
        where: { isDefault: true, isActive: true },
      });
      if (defaultCold) {
        destinationAddress = defaultCold.address as Address;
      }
    } catch {
      // Fallback to .env
    }

    if (!destinationAddress) {
      return reply.status(400).send({
        error: 'No active cold storage wallet configured in database or environment',
      });
    }

    const signer = options.walletManager.getSigner();
    const result = await options.drainService.buildDrainTransaction(
      options.rpc,
      signer,
      destinationAddress
    );

    if (!result.success) {
      return reply.status(500).send({
        success: false,
        error: result.error,
      });
    }

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
