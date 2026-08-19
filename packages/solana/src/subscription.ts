import {
  RpcSubscriptions,
  SolanaRpcSubscriptionsApi,
  Slot,
} from '@solana/kit';
import { Logger } from 'pino';

export type SlotNotificationCallback = (slot: Slot) => void | Promise<void>;

export class SolanaSubscriptionManager {
  private readonly rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  private readonly logger: Logger | undefined;
  private isSubscribed = false;
  private abortController: AbortController | null = null;

  constructor(
    rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
    logger?: Logger
  ) {
    this.rpcSubscriptions = rpcSubscriptions;
    this.logger = logger;
  }

  public async subscribeToSlots(
    onSlot: SlotNotificationCallback
  ): Promise<void> {
    if (this.isSubscribed) {
      this.logger?.warn('Already subscribed to slot notifications');
      return;
    }

    this.isSubscribed = true;
    this.abortController = new AbortController();

    this.logger?.info('Starting Solana slot subscription stream...');

    try {
      const slotNotifications = await this.rpcSubscriptions
        .slotNotifications()
        .subscribe({ abortSignal: this.abortController.signal });

      for await (const notification of slotNotifications) {
        if (!this.isSubscribed) break;
        try {
          await onSlot(notification.slot);
        } catch (err: unknown) {
          this.logger?.error({ err }, 'Error handling slot notification');
        }
      }
    } catch (err: unknown) {
      if (this.abortController?.signal.aborted) {
        this.logger?.info('Slot subscription gracefully stopped');
      } else {
        this.logger?.error({ err }, 'Solana slot subscription encountered an error');
      }
    } finally {
      this.isSubscribed = false;
    }
  }

  public unsubscribe(): void {
    if (this.isSubscribed && this.abortController) {
      this.logger?.info('Unsubscribing from Solana slot notifications');
      this.abortController.abort();
      this.isSubscribed = false;
    }
  }

  public get active(): boolean {
    return this.isSubscribed;
  }
}
