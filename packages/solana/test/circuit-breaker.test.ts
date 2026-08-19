import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from '@solana-arbitrage/solana';
import { loadConfig } from '@solana-arbitrage/config';

describe('CircuitBreaker', () => {
  const config = loadConfig({
    MAX_TRADE_USD: '10',
    MAX_DAILY_LOSS_USD: '5',
    MAX_CONSECUTIVE_LOSSES: '3',
    TRADING_MODE: 'live',
  });

  it('should allow trades when no limits are exceeded', () => {
    const breaker = new CircuitBreaker(config);
    const check = breaker.canTrade(5.0);
    expect(check.allowed).toBe(true);
  });

  it('should reject trades exceeding MAX_TRADE_USD', () => {
    const breaker = new CircuitBreaker(config);
    const check = breaker.canTrade(15.0);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('MAX_TRADE_USD');
  });

  it('should trip on daily loss limit', () => {
    const breaker = new CircuitBreaker(config);

    // Record losses that exceed the daily limit
    breaker.recordTrade(-2.0);
    breaker.recordTrade(-2.0);
    breaker.recordTrade(-1.5);

    const state = breaker.getState();
    expect(state.isTripped).toBe(true);
    expect(state.tripReason).toContain('Daily loss limit');
    expect(state.dailyLossUsd).toBeGreaterThanOrEqual(5.0);

    // Should refuse new trades
    const check = breaker.canTrade(5.0);
    expect(check.allowed).toBe(false);
  });

  it('should trip on consecutive losses streak', () => {
    const breaker = new CircuitBreaker(config);

    // 3 consecutive losses (limit is 3)
    breaker.recordTrade(-0.01);
    breaker.recordTrade(-0.01);
    breaker.recordTrade(-0.01);

    const state = breaker.getState();
    expect(state.isTripped).toBe(true);
    expect(state.tripReason).toContain('consecutive losses');
    expect(state.consecutiveLosses).toBe(3);
  });

  it('should reset consecutive losses on a winning trade', () => {
    const breaker = new CircuitBreaker(config);

    breaker.recordTrade(-0.01);
    breaker.recordTrade(-0.01);
    breaker.recordTrade(0.05); // Win resets streak

    const state = breaker.getState();
    expect(state.isTripped).toBe(false);
    expect(state.consecutiveLosses).toBe(0);
  });

  it('should allow manual reset after tripping', () => {
    const breaker = new CircuitBreaker(config);

    // Trip it
    breaker.recordTrade(-2.0);
    breaker.recordTrade(-2.0);
    breaker.recordTrade(-1.5);
    expect(breaker.getState().isTripped).toBe(true);

    // Manual reset
    breaker.reset();
    const state = breaker.getState();
    expect(state.isTripped).toBe(false);
    expect(state.dailyLossUsd).toBe(0);
    expect(state.consecutiveLosses).toBe(0);
    expect(state.totalTradesToday).toBe(0);
  });
});
