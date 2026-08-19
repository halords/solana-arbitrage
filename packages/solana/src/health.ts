import { Rpc, SolanaRpcApi } from '@solana/kit';
import { AppConfig } from '@solana-arbitrage/config';
import { Logger } from 'pino';

export interface RpcHealthStatus {
  readonly isHealthy: boolean;
  readonly cluster: string;
  readonly endpoint: string;
  readonly currentSlot: bigint;
  readonly latencyMs: number;
  readonly lastCheckedAt: Date;
  readonly error?: string;
}

export class SolanaHealthMonitor {
  private readonly rpc: Rpc<SolanaRpcApi>;
  private readonly config: AppConfig;
  private readonly logger: Logger | undefined;

  constructor(rpc: Rpc<SolanaRpcApi>, config: AppConfig, logger?: Logger) {
    this.rpc = rpc;
    this.config = config;
    this.logger = logger;
  }

  public async checkHealth(): Promise<RpcHealthStatus> {
    const startTime = Date.now();
    try {
      const slotResponse = await this.rpc.getSlot().send();
      const latencyMs = Date.now() - startTime;
      const isHealthy = latencyMs <= this.config.MAX_RPC_LATENCY_MS;

      if (!isHealthy) {
        this.logger?.warn(
          { latencyMs, threshold: this.config.MAX_RPC_LATENCY_MS },
          'Solana RPC latency exceeded threshold'
        );
      }

      return {
        isHealthy,
        cluster: this.config.SOLANA_CLUSTER,
        endpoint: this.config.SOLANA_RPC_URL,
        currentSlot: slotResponse,
        latencyMs,
        lastCheckedAt: new Date(),
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      this.logger?.error({ err }, 'Solana RPC health check failed');

      return {
        isHealthy: false,
        cluster: this.config.SOLANA_CLUSTER,
        endpoint: this.config.SOLANA_RPC_URL,
        currentSlot: BigInt(0),
        latencyMs,
        lastCheckedAt: new Date(),
        error: message,
      };
    }
  }
}
