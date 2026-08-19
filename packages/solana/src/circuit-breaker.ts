import { AppConfig } from '@solana-arbitrage/config';
import { Logger } from 'pino';

export interface CircuitBreakerState {
  readonly isTripped: boolean;
  readonly tripReason: string | null;
  readonly dailyLossUsd: number;
  readonly consecutiveLosses: number;
  readonly totalTradesToday: number;
  readonly lastResetAt: Date;
}

export class CircuitBreaker {
  private readonly config: AppConfig;
  private readonly logger: Logger | undefined;

  private dailyLossUsd = 0;
  private dailyGainUsd = 0;
  private consecutiveLosses = 0;
  private totalTradesToday = 0;
  private tripped = false;
  private tripReason: string | null = null;
  private lastResetAt: Date = new Date();
  private lastResetDay: number = new Date().getUTCDate();

  constructor(config: AppConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Record a completed trade result. Returns false if circuit breaker trips.
   */
  public recordTrade(profitUsd: number): boolean {
    // Auto-reset at midnight UTC
    this.checkDayRollover();

    this.totalTradesToday++;

    if (profitUsd < 0) {
      this.dailyLossUsd += Math.abs(profitUsd);
      this.consecutiveLosses++;
    } else {
      this.dailyGainUsd += profitUsd;
      this.consecutiveLosses = 0;
    }

    // Check trip conditions
    return this.evaluate();
  }

  /**
   * Pre-trade check: is it safe to execute?
   */
  public canTrade(tradeAmountUsd: number): { allowed: boolean; reason?: string } {
    this.checkDayRollover();

    if (this.tripped) {
      return { allowed: false, reason: `Circuit breaker tripped: ${this.tripReason}` };
    }

    // Rule 1: Max single trade cap
    if (tradeAmountUsd > this.config.MAX_TRADE_USD) {
      return {
        allowed: false,
        reason: `Trade amount $${tradeAmountUsd.toFixed(2)} exceeds MAX_TRADE_USD cap of $${this.config.MAX_TRADE_USD.toFixed(2)}`,
      };
    }

    // Rule 2: Daily loss limit
    if (this.dailyLossUsd >= this.config.MAX_DAILY_LOSS_USD) {
      this.trip(`Daily loss limit reached: $${this.dailyLossUsd.toFixed(4)} >= $${this.config.MAX_DAILY_LOSS_USD.toFixed(2)}`);
      return { allowed: false, reason: this.tripReason! };
    }

    // Rule 3: Consecutive losses
    const maxConsecutive = this.config.MAX_CONSECUTIVE_LOSSES ?? 5;
    if (this.consecutiveLosses >= maxConsecutive) {
      this.trip(`${this.consecutiveLosses} consecutive losses (limit: ${maxConsecutive})`);
      return { allowed: false, reason: this.tripReason! };
    }

    return { allowed: true };
  }

  /**
   * Get current circuit breaker state for dashboard display
   */
  public getState(): CircuitBreakerState {
    this.checkDayRollover();
    return {
      isTripped: this.tripped,
      tripReason: this.tripReason,
      dailyLossUsd: parseFloat(this.dailyLossUsd.toFixed(4)),
      consecutiveLosses: this.consecutiveLosses,
      totalTradesToday: this.totalTradesToday,
      lastResetAt: this.lastResetAt,
    };
  }

  /**
   * Manually reset the circuit breaker (admin action)
   */
  public reset(): void {
    this.tripped = false;
    this.tripReason = null;
    this.dailyLossUsd = 0;
    this.dailyGainUsd = 0;
    this.consecutiveLosses = 0;
    this.totalTradesToday = 0;
    this.lastResetAt = new Date();
    this.lastResetDay = new Date().getUTCDate();
    this.logger?.info('🔄 Circuit breaker manually reset');
  }

  private evaluate(): boolean {
    // Rule 1: Daily loss limit
    if (this.dailyLossUsd >= this.config.MAX_DAILY_LOSS_USD) {
      this.trip(`Daily loss limit reached: $${this.dailyLossUsd.toFixed(4)} >= $${this.config.MAX_DAILY_LOSS_USD.toFixed(2)}`);
      return false;
    }

    // Rule 2: Consecutive losses
    const maxConsecutive = this.config.MAX_CONSECUTIVE_LOSSES ?? 5;
    if (this.consecutiveLosses >= maxConsecutive) {
      this.trip(`${this.consecutiveLosses} consecutive losses (limit: ${maxConsecutive})`);
      return false;
    }

    return true;
  }

  private trip(reason: string): void {
    this.tripped = true;
    this.tripReason = reason;
    this.logger?.error({ reason }, '🚨 CIRCUIT BREAKER TRIPPED — All live trading halted');
  }

  private checkDayRollover(): void {
    const currentDay = new Date().getUTCDate();
    if (currentDay !== this.lastResetDay) {
      this.logger?.info(
        { previousDay: this.lastResetDay, newDay: currentDay },
        '🌅 Midnight UTC rollover — resetting daily circuit breaker counters'
      );
      this.dailyLossUsd = 0;
      this.dailyGainUsd = 0;
      this.consecutiveLosses = 0;
      this.totalTradesToday = 0;
      this.tripped = false;
      this.tripReason = null;
      this.lastResetDay = currentDay;
      this.lastResetAt = new Date();
    }
  }
}
