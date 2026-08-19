# Architectural Decision Records (ADR) — `DECISION.md`

This document records the architectural and technology decisions made for the **Solana Automated Arbitrage Platform**, detailing context, decision outcomes, and consequences.

---

## ADR-001: Adoption of `@solana/kit` as Primary TypeScript SDK

### Context
Legacy Solana applications heavily used `@solana/web3.js` (v1). Solana released and standardized `@solana/kit` (the composable, functional, tree-shakeable web3.js v2 successor) as the recommended TypeScript SDK, offering improved type safety, zero NodeJS-specific polyfill requirements, and fine-grained RPC methods.

### Decision
Use `@solana/kit` exclusively for all Solana RPC interaction, transaction simulation, account subscriptions, and future transaction serialization. Avoid legacy `@solana/web3.js` v1 dependencies.

### Consequences
- **Positive:** Modern functional API, zero polyfill bloat, faster runtime serialization, future-proof.
- **Negative:** Certain legacy 3rd-party DEX SDKs still export types expecting v1 `PublicKey` or `Connection`. Adapter layers must bridge between external structures and `@solana/kit` types.

---

## ADR-002: DEX Adapter Architecture Pattern

### Context
The platform must support Raydium (AMM v4, CPMM, CLMM) and subsequent DEXs (Orca Whirlpools, Meteora, Phoenix) without modifying the core opportunity detection and risk engine.

### Decision
Implement a standard `DexAdapter` interface:
```typescript
export interface DexAdapter {
  readonly id: string;
  readonly name: string;
  getPools(tokenPair: TokenPair): Promise<PoolState[]>;
  getQuote(request: QuoteRequest): Promise<QuoteResponse>;
  getLiquidity(poolId: string): Promise<LiquidityDepth>;
}
```
All DEX-specific SDK calls, Trade API interactions, and decimal encodings remain completely encapsulated inside `packages/dex-adapters`.

### Consequences
- **Positive:** Adding a new DEX requires zero modifications to the arbitrage detection, risk engine, or dashboard.
- **Negative:** Adapter design must cater to the lowest common denominator or provide capability flags (e.g. `supportsSimulation`, `supportsCLMM`).

---

## ADR-003: Deterministic Financial Engine vs. AI/LLM Decisioning

### Context
Using LLMs or probabilistic heuristics for trade decisioning introduces non-deterministic latency, hallucinated trade parameters, and financial risk.

### Decision
Trading decisions, fee subtraction, slippage calculation, and risk rule validations MUST be 100% deterministic, implemented in pure TypeScript functions, and validated against explicit math formulas. AI is restricted to offline backtest analytics, documentation, and tooling.

### Consequences
- **Positive:** Predictable, ultra-fast (<1ms) decision loops, fully unit-testable, auditable.
- **Negative:** Cannot dynamically improvise novel execution patterns without explicit programmatic rule implementation.

---

## ADR-004: Paper-Trading & Simulation Mode First (Zero Real Funds in Phase 1)

### Context
Live on-chain arbitrage in high-frequency Solana environments involves significant MEV competition, priority fee burn, and slippage risk. Running unvalidated code with real funds leads to immediate capital drain.

### Decision
Hardcode Phase 1 to paper trading (`TRADING_MODE=paper`). Opportunity detection, simulation, profit accounting, and trade recording will function with 100% fidelity without holding private keys or signing live transactions.

### Consequences
- **Positive:** Zero risk of capital loss during research, algorithm tuning, and system stability validation.
- **Negative:** Paper trading does not capture actual on-chain transaction landing competition against MEV searchers (which is addressed in Phase 4 & 5).

---

## ADR-005: Decimal Precision & Fixed-Point Math Standards

### Context
JavaScript native `number` is an IEEE 754 double-precision float, prone to precision drift (e.g., `0.1 + 0.2 !== 0.3`). In decentralized arbitrage with multi-million base token units and micro-dollar fees, floating point inaccuracies cause false opportunity triggers and accounting drift.

### Decision
1. **On-chain token amounts & Lamports:** Represented exclusively as `bigint` (or string when serialized).
2. **Financial calculations (USD, Spreads, ROI, Fees):** Handled using `Decimal.js` (fixed-precision arithmetic) or integer micro-cents / basis points.
3. Native `number` is restricted strictly to non-monetary counters and UI percentages for display.

### Consequences
- **Positive:** Zero rounding bugs, 100% accurate financial auditing.
- **Negative:** Explicit type conversions between `bigint`, `Decimal`, and strings.

---

## ADR-006: Hybrid Persistence (PostgreSQL + Redis)

### Context
The platform generates high-frequency market quotes and opportunity evaluations (hundreds per second) while requiring long-term relational querying for paper trading performance, risk audits, and dashboard reporting.

### Decision
- **Redis:** Used as ephemeral, ultra-fast in-memory cache for current prices, pool states, active opportunity locks, and deduplication fingerprints (`SET NX EX`).
- **PostgreSQL:** System of record for persistent historical tables (`tokens`, `dexes`, `pools`, `opportunities`, `trades`, `risk_events`).

### Consequences
- **Positive:** Low latency for market data loops; robust relational query capabilities for analytics.
- **Negative:** Requires running and orchestrating both services in Docker Compose.
