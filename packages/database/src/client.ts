import { PrismaClient } from '@prisma/client';
import { AppConfig } from '@solana-arbitrage/config';
import { Logger } from 'pino';

export interface DatabaseHealthStatus {
  readonly isHealthy: boolean;
  readonly latencyMs: number;
  readonly lastCheckedAt: Date;
  readonly error?: string;
}

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(config?: AppConfig, logger?: Logger): PrismaClient {
  if (!prismaInstance) {
    const databaseUrl =
      config?.DATABASE_URL ??
      process.env['DATABASE_URL'] ??
      'postgresql://arbitrage_user:arbitrage_secure_password_dev@localhost:5432/arbitrage?schema=public';

    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: ['error', 'warn'],
    });

    if (logger) {
      logger.info('Initialized Prisma database client');
    }
  }

  return prismaInstance;
}

export async function checkDatabaseHealth(
  prisma: PrismaClient
): Promise<DatabaseHealthStatus> {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      isHealthy: true,
      latencyMs: Date.now() - startTime,
      lastCheckedAt: new Date(),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isHealthy: false,
      latencyMs: Date.now() - startTime,
      lastCheckedAt: new Date(),
      error: message,
    };
  }
}
