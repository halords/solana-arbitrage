import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().default('solana-arbitrage'),
  APP_PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  SOLANA_CLUSTER: z.enum(['devnet', 'mainnet-beta']).default('devnet'),
  SOLANA_RPC_URL: z.string().url().default('https://api.devnet.solana.com'),
  SOLANA_WS_URL: z.string().default('wss://api.devnet.solana.com/'),
  SOLANA_COMMITMENT: z.enum(['processed', 'confirmed', 'finalized']).default('confirmed'),
  MAX_RPC_LATENCY_MS: z.coerce.number().default(1500),

  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().default(5432),
  DATABASE_NAME: z.string().default('arbitrage'),
  DATABASE_USER: z.string().default('arbitrage_user'),
  DATABASE_PASSWORD: z.string().default('arbitrage_secure_password_dev'),
  DATABASE_SSL: z.coerce.boolean().default(false),
  DATABASE_URL: z.string().optional(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default('redis_secure_password_dev'),
  REDIS_URL: z.string().optional(),

  TRADING_MODE: z.enum(['paper', 'live']).default('paper'),
  WALLET_ENABLED: z.coerce.boolean().default(false),

  MIN_PROFIT_USD: z.coerce.number().default(0.05),
  MIN_ROI_PERCENT: z.coerce.number().default(0.1),
  MAX_TRADE_USD: z.coerce.number().default(100.0),
  MAX_SLIPPAGE_PERCENT: z.coerce.number().default(0.3),
  MIN_LIQUIDITY_USD: z.coerce.number().default(10000.0),
  MAX_QUOTE_AGE_MS: z.coerce.number().default(1000),
  MAX_DAILY_LOSS_USD: z.coerce.number().default(10.0),
  MAX_CONCURRENT_TRADES: z.coerce.number().default(1),

  PRICE_UPDATE_INTERVAL_MS: z.coerce.number().default(250),
  POOL_REFRESH_INTERVAL_MS: z.coerce.number().default(5000),
  OPPORTUNITY_SCAN_INTERVAL_MS: z.coerce.number().default(100),

  RAYDIUM_ENABLED: z.coerce.boolean().default(true),
  ORCA_ENABLED: z.coerce.boolean().default(false),

  API_AUTH_ENABLED: z.coerce.boolean().default(true),
  JWT_SECRET: z.string().min(16).default('development_jwt_secret_must_be_long_and_secure'),
  API_RATE_LIMIT: z.coerce.number().default(100),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${errorDetails}`);
  }
  return result.data;
}
