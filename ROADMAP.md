# Solana Automated Arbitrage Platform — Project Roadmap

This roadmap operationalizes the **Software Requirements Specification (SRS)** for the Solana Automated Arbitrage Research and Trading Platform into actionable sprints, milestones, acceptance criteria, and future execution phases.

---

## 🎯 High-Level Vision & Strategy

```
Phase 1: Foundation, Simulation & Paper Trading (Current)
   │
   ▼
Phase 2: Historical Data, Latency Benchmarking & Backtesting
   │
   ▼
Phase 3: Devnet Execution & Signer Infrastructure
   │
   ▼
Phase 4: Controlled Mainnet Execution ($10–$100 Micro-Cap Live Alpha)
   │
   ▼
Phase 5: Performance Optimization (Jito MEV, Priority Fees, WebSockets)
   │
   ▼
Phase 6: Advanced On-Chain CPI / Custom Programs (If Justified)
```

---

## 📅 Phase 1: Foundation, Simulation & Paper Trading (Sprints 1 – 10)

### 🔹 Sprint 1: Project Foundation & Environment Setup
- **Goal:** Set up the monorepo architecture, strict type checking, linting, Docker orchestration, and validated configuration.
- **SRS Reference:** Section 16 (P1-001 – P1-004), Section 11, Section 12
- **Key Tasks:**
  - [x] Create monorepo skeleton (`/apps/*`, `/packages/*`).
  - [x] Configure strict TypeScript (`tsconfig.json`), ESLint (`.eslintrc.json`), and Prettier.
  - [x] Setup Docker Compose with PostgreSQL 16, Redis 7, API, Arbitrage Engine, Market Data, Simulation Engine, and Nginx.
  - [x] Implement schema-validated environment configuration using `zod` in `@solana-arbitrage/config`.
  - [x] Implement structured JSON logging with automatic secret masking in `@solana-arbitrage/logging`.
- **Sprint Acceptance Criteria:**
  - `npm run lint` and `npx tsc --noEmit` execute with 0 errors across all workspaces.
  - `docker compose config` validates without errors.

---

### 🔹 Sprint 2: Database Layer & State Persistence
- **Goal:** Establish PostgreSQL relational models, migrations, indexes, and Redis caching layers.
- **SRS Reference:** Section 8 (8.1 – 8.10), Section 16 (P1-005 – P1-008)
- **Key Tasks:**
  - [x] Implement Prisma schema mapping all 10 domain entities (`dexes`, `tokens`, `pools`, `price_snapshots`, `opportunities`, `simulations`, `trades`, `risk_events`, `bot_runs`, `system_events`).
  - [x] Apply database indexes for high-throughput queries (`pool_id`, `observed_at`, `fingerprint`, `status`).
  - [x] Build Redis repository for sub-millisecond market state caching and duplicate opportunity fingerprint deduplication (`SET NX EX`).
  - [x] Create seed scripts for initial token whitelists (SOL, USDC, USDT) and DEX definitions (Raydium, Orca).
- **Sprint Acceptance Criteria:**
  - Automated migration / client generation runs cleanly in PostgreSQL test schema.
  - Read/write benchmarks for price snapshots and opportunities meet <5ms execution time.

---

### 🔹 Sprint 3: Solana Connectivity & RPC Health
- **Goal:** Establish resilient RPC and WebSocket connectivity using `@solana/kit`.
- **SRS Reference:** Section 6 (FR-001, FR-002), Section 16 (P1-009 – P1-012)
- **Key Tasks:**
  - [x] Implement `@solana/kit` client factory supporting Devnet and Mainnet-beta clusters.
  - [x] Implement RPC health monitoring: periodic `getSlot`, latency measurements, and degradation detection.
  - [x] Build WebSocket subscription manager with backoff/reconnection logic for account and slot updates.
  - [x] Expose RPC health status through structured telemetry and test with vitest.
- **Sprint Acceptance Criteria:**
  - Graceful reconnection and alert emission when RPC drops or latency exceeds configured threshold (`MAX_RPC_LATENCY_MS`).

---

### 🔹 Sprint 4: DEX Adapter Framework & Raydium Integration
- **Goal:** Build the pluggable DEX adapter abstraction and Raydium pool/quote parser.
- **SRS Reference:** Section 6 (FR-004, FR-005, FR-006), Section 16 (P1-013 – P1-015)
- **Key Tasks:**
  - [x] Define generic TypeScript interface `DexAdapter` (`getMarkets`, `getPools`, `getQuote`, `getLiquidity`).
  - [x] Implement `RaydiumAdapter` integrating AMM pool quote calculations and 0.25% fee tier math.
  - [x] Implement `OrcaAdapter` (Whirlpool / CLMM quote calculation and fee tier math).
  - [x] Unit test quote calculations and registry lookup against token fixtures.
- **Sprint Acceptance Criteria:**
  - Live quote retrieval across Raydium and Orca for SOL/USDC with deterministic parsing.

---

### 🔹 Sprint 5: Market Data Service & Discovery
- **Goal:** Continual liquidity polling, token registry enforcement, and Redis state updating.
- **SRS Reference:** Section 6 (FR-003), Section 16 (P1-016 – P1-019)
- **Key Tasks:**
  - [x] Implement token and pool registry with whitelist enforcement (`SEC-006`).
  - [x] Implement scheduled/event-driven price polling workers with jitter and rate-limiting.
  - [x] Stream price snapshots to PostgreSQL and cache latest quotes in Redis.
  - [x] Test market data poller and token whitelist integration with vitest.
- **Sprint Acceptance Criteria:**
  - Market data service updates pool states every `PRICE_UPDATE_INTERVAL_MS` (250ms target) without memory leaks.

---

### 🔹 Sprint 6: Arbitrage & Profitability Engine
- **Goal:** Cross-DEX price comparison, bidirectional evaluation, and comprehensive fee/slippage modeling.
- **SRS Reference:** Section 6 (FR-007 – FR-015), Section 16 (P1-020 – P1-024)
- **Key Tasks:**
  - [x] Implement cross-market price spread comparison ($A \to B$ and $B \to A$).
  - [x] Evaluate configurable trade sizes ($10, $25, $50, $100, $250, $500).
  - [x] Calculate deterministic net profit:
    $$\text{Net Profit} = \text{Gross Profit} - \text{DEX Fees} - \text{Network Fees} - \text{Priority Fees} - \text{Slippage} - \text{Price Impact} - \text{Safety Buffer}$$
  - [x] Implement Phase 1 Risk Engine (`MAX_TRADE_USD`, `MIN_PROFIT_USD`, `MIN_ROI_PERCENT`, `MAX_SLIPPAGE_PERCENT`, `MAX_QUOTE_AGE_MS`).
  - [x] Generate deterministic opportunity fingerprints and Redis lock deduplication.
- **Sprint Acceptance Criteria:**
  - 100% test coverage on net profit calculation and risk rule boundaries using mock market data.

---

### 🔹 Sprint 7: Simulation Engine & Paper Trading
- **Goal:** High-fidelity paper trading execution ledger and simulated transaction evaluation.
- **SRS Reference:** Section 6 (FR-016 – FR-020), Section 16 (P1-025 – P1-028)
- **Key Tasks:**
  - [x] Opportunity expiration manager: reject opportunities older than `MAX_QUOTE_AGE_MS` (1000ms).
  - [x] Transaction simulation service evaluating compute usage and execution output.
  - [x] Paper trade worker: execute simulated fills, calculate actual simulated output, log to `trades` ledger (`mode = 'PAPER'`).
  - [x] Performance calculator: aggregate win rate, net paper P/L, average profit/loss, daily loss tracker.
- **Sprint Acceptance Criteria:**
  - Paper trades execute end-to-end without touching real funds or private keys (`TRADING_MODE=paper` verified).

---

### 🔹 Sprint 8: REST API & Administrative Endpoints
- **Goal:** Secure backend API for the monitoring dashboard and system operations.
- **SRS Reference:** Section 9 (9.1 – 9.11), Section 16 (P1-029 – P1-030)
- **Key Tasks:**
  - [x] Implement Fastify REST endpoints (`/health`, `/system/status`, `/dexes`, `/tokens`, `/pools`, `/opportunities`, `/performance`, `/config`).
  - [x] Implement rate limiting, Helmet, and CORS security headers.
  - [x] Implement emergency Kill Switch endpoint (`POST /system/kill-switch`).
  - [x] Integration testing with Fastify `inject()` across all endpoints.
- **Sprint Acceptance Criteria:**
  - All endpoints pass schema validation and automated integration tests.

---

### 🔹 Sprint 9: Real-Time Web Dashboard
- **Goal:** Next.js / React interactive dashboard with real-time WebSocket updates.
- **SRS Reference:** Section 6 (FR-021), Section 16 (P1-031 – P1-033)
- **Key Tasks:**
  - [x] System status widget (RPC latency, slot height, trading mode badge, uptime).
  - [x] Live opportunity feed with spread, estimated profit, ROI, and expiration timers.
  - [x] Performance metrics widget (Paper P/L, win rate, total opportunities detected vs paper traded).
  - [x] Risk safeguard summary and emergency kill-switch integration.
- **Sprint Acceptance Criteria:**
  - Dashboard UI renders without errors and passes strict TypeScript & ESLint gates.

---

### 🔹 Sprint 10: End-to-End Testing & Security Audit
- **Goal:** Full integration validation, load testing, and security hardening sign-off.
- **SRS Reference:** Section 15, Section 16 (P1-034 – P1-036), Section 23
- **Key Tasks:**
  - [x] End-to-end integration test: simulated price anomaly $\to$ opportunity detection $\to$ risk check $\to$ paper trade $\to$ Postgres/API $\to$ Dashboard.
  - [x] Core business logic unit test coverage $\ge 80\%$.
  - [x] Complete security checklist audit (Zero secrets in git/logs, non-root containers, allowlists enforced).
  - [x] Verification of all Phase 1 Acceptance Criteria (AC-001 to AC-012).
- **Sprint Acceptance Criteria:**
  - All CI tests pass, zero vulnerabilities in `npm audit`, Definition of Done verified.

---

## 🚀 Future Phases (Post-Phase 1)

| Phase | Focus | Core Deliverables | Pre-Requisites |
| :--- | :--- | :--- | :--- |
| **Phase 2: Advanced Analytics & Backtesting** | Historical Data & Optimization | Tick data archiver, backtesting framework, latency profiler, route graph optimization. | Phase 1 Paper Trading with $\ge 10,000$ recorded opportunities. |
| **Phase 3: Devnet Live Execution** | Safe Blockchain Submission | Dedicated Devnet keypair, transaction builder, priority fee estimator, signature confirmation listener. | Phase 2 latency benchmarks verified $< 200\text{ms}$. |
| **Phase 4: Controlled Mainnet Alpha** | Micro-Cap Real Trading | KMS-backed dedicated hot wallet, strict $10–$50 hard cap, automated daily loss kill-switch, emergency fund drain script. | Security audit, 14 days profitable Devnet execution. |
| **Phase 5: Advanced MEV & Execution** | MEV Protection & Speed | Jito block engine bundle integration, dynamic priority fee bidding, localized RPC nodes, direct gRPC geyser streams. | Mainnet Alpha operational stability. |
| **Phase 6: Custom On-Chain Program** | Atomic Arbitrage Program | Rust/Anchor on-chain swap bundle program for atomic Buy+Sell in a single transaction (reverts on negative slippage). | Proof of profitability loss due to non-atomic execution. |

---

## 🛡️ Risk Management Matrix

| Risk | Likelihood | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Accidental Real Money Execution** | Low | High | Hardcoded `TRADING_MODE=paper`, no wallet signer in Phase 1 codebase, CI build failure if private keys detected. |
| **Stale Quote Slippage** | High | Medium | `MAX_QUOTE_AGE_MS=1000` enforced at risk engine and simulation layer. |
| **RPC Rate Limiting & Outages** | High | Low | Exponential backoff, multi-RPC fallback pool, dedicated RPC nodes for production. |
| **Floating Point Financial Precision Errors** | Medium | High | Mandatory `BigInt` (base units) or `Decimal.js` (financial USD) — zero native floating point calculations. |
