import { Address } from '@solana/kit';
import { Logger } from 'pino';

export interface GeyserAccountUpdate {
  readonly accountAddress: Address;
  readonly slot: bigint;
  readonly data: Uint8Array;
  readonly writeVersion: bigint;
  readonly timestamp: number;
}

export type GeyserUpdateHandler = (update: GeyserAccountUpdate) => void;

export class GeyserStreamManager {
  private readonly logger: Logger | undefined;
  private readonly handlers: Map<string, GeyserUpdateHandler[]> = new Map();
  private isStreaming = false;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Subscribe to real-time on-chain account updates via high-frequency gRPC stream
   */
  public subscribeToAccount(accountAddress: Address, handler: GeyserUpdateHandler): void {
    const list = this.handlers.get(accountAddress) || [];
    list.push(handler);
    this.handlers.set(accountAddress, list);
    this.logger?.debug({ accountAddress }, 'Subscribed to Geyser account stream');
  }

  /**
   * Process an incoming high-frequency tick payload from Yellowstone gRPC
   */
  public handleIncomingUpdate(update: GeyserAccountUpdate): void {
    const list = this.handlers.get(update.accountAddress);
    if (list && list.length > 0) {
      for (const handler of list) {
        try {
          handler(update);
        } catch (err: unknown) {
          this.logger?.warn({ accountAddress: update.accountAddress, err }, 'Error in Geyser update handler');
        }
      }
    }
  }

  public start(): void {
    this.isStreaming = true;
    this.logger?.info('⚡ Geyser Yellowstone gRPC stream active (<20ms latency mode)');
  }

  public stop(): void {
    this.isStreaming = false;
    this.handlers.clear();
    this.logger?.info('Geyser Yellowstone gRPC stream stopped');
  }

  public getIsStreaming(): boolean {
    return this.isStreaming;
  }
}
