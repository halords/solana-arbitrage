# Software Requirements Specification (SRS)

## Solana Automated Arbitrage Research and Trading Platform

**Document Version:** 1.0
**Status:** Development Specification
**Initial Deployment Mode:** Observation / Paper Trading
**Blockchain:** Solana
**Primary Language:** TypeScript
**Primary SDK:** `@solana/kit`
**Database:** PostgreSQL
**Cache:** Redis
**Deployment:** Docker / Docker Compose

---

# 1. Introduction

## 1.1 Purpose

This document defines the software requirements, architecture, interfaces, data model, security requirements, deployment requirements, and Phase 1 development backlog for a Solana-based automated arbitrage research and trading platform.

The system will monitor decentralized exchanges (DEXs) operating on Solana, identify potential price discrepancies, estimate realistic profitability, simulate potential trades, and record the results.

The initial system will **not execute real-money trades**.

The first objective is to determine whether detected arbitrage opportunities remain profitable after accounting for:

* DEX fees
* Solana network fees
* Priority fees
* Slippage
* Price impact
* Liquidity
* Transaction latency
* Failed transactions
* Execution uncertainty
* Safety margins

Only after sufficient paper-trading and simulation evidence has been collected should live execution be considered.

---

# 2. Objectives

The system shall:

1. Connect to the Solana blockchain.
2. Monitor selected DEXs.
3. Maintain current market and liquidity information.
4. Detect potential arbitrage opportunities.
5. Calculate estimated gross and net profitability.
6. Evaluate multiple trade sizes.
7. Simulate transactions where supported.
8. Record opportunities and simulation results.
9. Provide a dashboard for monitoring.
10. Support paper trading.
11. Provide comprehensive logging and metrics.
12. Provide configurable risk controls.
13. Support multiple DEX adapters.
14. Maintain a clear separation between detection and execution.
15. Allow live execution to be enabled only through explicit configuration and security controls.

---

# 3. Scope

## 3.1 Included

### Phase 1

* Solana RPC connectivity
* Solana WebSocket/subscription connectivity where appropriate
* Token configuration
* DEX adapter architecture
* Initial DEX integrations
* Pool/market discovery
* Price monitoring
* Liquidity monitoring
* Arbitrage detection
* Profitability calculation
* Trade-size optimization
* Opportunity persistence
* Paper-trading simulation
* Basic transaction simulation capability
* PostgreSQL database
* Redis cache
* REST API
* Web dashboard
* Docker deployment
* Structured logging
* Health checks
* Basic metrics
* Security controls
* Automated tests

### Future phases

* Real transaction execution
* Dedicated trading wallet
* Advanced priority-fee optimization
* Additional DEXs
* Advanced routing
* High-frequency execution
* Custom Solana program
* Advanced MEV/execution optimization

---

# 4. System Architecture

## 4.1 Logical Architecture

```text
                         SOLANA NETWORK
                              │
                   ┌──────────┴──────────┐
                   │                     │
                RPC API              WebSocket
                   │                     │
                   ▼                     ▼
          ┌────────────────────────────────────┐
          │        MARKET DATA SERVICE         │
          │                                    │
          │  Token data                        │
          │  Pool state                        │
          │  Prices                            │
          │  Liquidity                         │
          └────────────────┬───────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │   DEX ADAPTER LAYER  │
                │                      │
                │ Raydium              │
                │ Orca                 │
                │ Future DEXs          │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │ OPPORTUNITY ENGINE    │
                │                      │
                │ Price comparison      │
                │ Route discovery       │
                │ Trade-size analysis   │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │ PROFITABILITY ENGINE │
                │                      │
                │ DEX fees             │
                │ Network fees         │
                │ Priority fees        │
                │ Slippage             │
                │ Price impact         │
                │ Safety margin        │
                └──────────┬───────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ RISK ENGINE  │
                    └──────┬───────┘
                           │
                           ▼
                 ┌────────────────────┐
                 │ SIMULATION ENGINE  │
                 └─────────┬──────────┘
                           │
                           ▼
                    PAPER TRADING
                           │
                           ▼
                 ┌────────────────────┐
                 │    PostgreSQL      │
                 └────────────────────┘

                 ┌────────────────────┐
                 │       Redis        │
                 │ Fast market state  │
                 └────────────────────┘

                 ┌────────────────────┐
                 │     Dashboard      │
                 └────────────────────┘
```

---

# 5. Architectural Principles

The system shall follow these principles:

### 5.1 Detection and execution separation

The opportunity detector shall not directly submit blockchain transactions.

The intended flow is:

```text
Market Data
    ↓
Opportunity
    ↓
Profitability
    ↓
Risk
    ↓
Simulation
    ↓
Execution
```

This makes it possible to operate the system indefinitely without allowing it to spend real funds.

### 5.2 DEX abstraction

DEX-specific functionality shall be isolated behind adapters.

```text
DexAdapter
    │
    ├── RaydiumAdapter
    ├── OrcaAdapter
    └── FutureAdapter
```

### 5.3 Deterministic trading logic

The production trading decision shall not depend on an LLM.

AI may be used for:

* code generation
* analytics
* strategy research
* backtesting analysis
* anomaly investigation

The production decision engine shall use deterministic rules.

### 5.4 Configuration over hardcoding

Trading thresholds, token lists, DEXs, polling intervals, and risk limits shall be configurable.

### 5.5 Paper trading first

The system shall default to:

```text
TRADING_MODE=paper
```

Live trading shall require explicit configuration changes.

---

# 6. Functional Requirements

## FR-001 — Solana Connectivity

The system shall connect to a configurable Solana RPC endpoint.

The system shall support:

* Devnet
* Mainnet-beta

The implementation shall use `@solana/kit` as the primary Solana TypeScript SDK. Solana currently documents `@solana/kit` as its recommended TypeScript SDK and provides RPC, signer, transaction-planning and transaction-submission functionality through its composable packages.

---

## FR-002 — RPC Health Monitoring

The system shall periodically verify:

* RPC availability
* current slot
* response latency
* connection status

The system shall mark an RPC endpoint unhealthy when configured thresholds are exceeded.

---

## FR-003 — Market Data Collection

The system shall collect:

* token information
* pool information
* token pair
* reserves/liquidity
* current quote
* DEX
* timestamp
* source
* block/slot where available

---

## FR-004 — DEX Adapter

Each DEX integration shall implement a common interface.

Required operations:

```text
getMarkets()
getPool()
getQuote()
getLiquidity()
buildSwapTransaction()
simulateSwap()
```

Not every operation must be available for every DEX in Phase 1.

---

## FR-005 — Raydium Integration

The initial implementation shall support Raydium.

Raydium currently documents its TypeScript SDK and Trade API as integration options. Its documentation specifically identifies the Trade API as an appropriate integration path for backends and bots, while the TypeScript SDK provides greater control.

The implementation shall avoid relying on legacy Raydium APIs for new functionality where a current API is available. Raydium currently identifies API v1 as legacy and recommends API v3 for new integrations.

---

## FR-006 — Additional DEX

The architecture shall allow another Solana DEX to be integrated without modifying the core arbitrage engine.

Initial target:

```text
Raydium
+
Orca or another suitable DEX
```

The exact second DEX shall be finalized during implementation based on current API/SDK availability, liquidity, and integration reliability.

---

## FR-007 — Price Comparison

The system shall compare equivalent token pairs across DEXs.

Example:

```text
SOL/USDC

Raydium:
180.21 USDC

DEX B:
180.37 USDC
```

The system shall calculate:

```text
absolute difference
percentage difference
```

---

## FR-008 — Arbitrage Opportunity Detection

The system shall identify:

### Direction A

```text
DEX A
Buy Token
    ↓
DEX B
Sell Token
```

### Direction B

```text
DEX B
Buy Token
    ↓
DEX A
Sell Token
```

Both directions shall be evaluated.

---

## FR-009 — Trade Size Optimization

The system shall evaluate multiple configurable trade sizes.

Example:

```text
$10
$25
$50
$100
$250
$500
```

The system shall identify the trade size producing the highest expected net profit while respecting risk limits.

---

## FR-010 — Fee Calculation

The profitability engine shall calculate or estimate:

* DEX fees
* Solana transaction fees
* priority fees
* other known execution costs

---

## FR-011 — Slippage Estimation

The system shall estimate slippage based on:

* trade size
* pool liquidity
* quoted output
* expected execution price

---

## FR-012 — Price Impact

The system shall estimate price impact where sufficient pool information is available.

---

## FR-013 — Net Profit Calculation

The system shall calculate:

```text
Net Profit =
Gross Profit
- DEX Fees
- Network Fees
- Priority Fees
- Slippage Cost
- Price Impact
- Safety Buffer
```

---

## FR-014 — Minimum Profit Rule

An opportunity shall only qualify as a candidate when:

```text
net_profit >= minimum_profit
```

and:

```text
ROI >= minimum_roi
```

Both shall be configurable.

---

## FR-015 — Risk Rules

The system shall support configurable:

* maximum trade size
* minimum profit
* minimum ROI
* maximum slippage
* minimum liquidity
* maximum daily loss
* maximum concurrent trades
* allowed tokens
* allowed DEXs
* stale-price threshold

---

## FR-016 — Opportunity Expiration

Every opportunity shall have an expiration time.

An opportunity shall be considered stale when:

```text
current_time - quote_timestamp > maximum_quote_age
```

Stale opportunities shall not be simulated or executed.

---

## FR-017 — Duplicate Prevention

The system shall prevent duplicate processing of the same opportunity.

An opportunity fingerprint may be generated from:

```text
token pair
buy DEX
sell DEX
trade size
source slot
quote timestamp
```

---

## FR-018 — Transaction Simulation

Before future live execution, the system shall support transaction simulation.

Simulation results shall record:

* success/failure
* expected output
* error
* compute usage where available
* simulation timestamp

Solana transaction responses expose structured metadata that can be used to inspect transaction execution and results.

---

## FR-019 — Paper Trading

The system shall provide a paper-trading mode.

Paper trades shall behave as though they were executed but shall not submit transactions.

Example:

```text
Input:
$100

Expected:
$100.31

Estimated costs:
$0.18

Paper profit:
$0.13
```

---

## FR-020 — Trade Ledger

Every paper trade shall be recorded.

Required fields:

* opportunity
* input
* expected output
* expected profit
* actual/simulated result
* fees
* status
* timestamp

---

## FR-021 — Dashboard

The dashboard shall display:

### System status

* bot status
* trading mode
* Solana cluster
* RPC status
* latest slot
* uptime

### Market

* monitored DEXs
* token pairs
* liquidity
* latest prices

### Opportunities

* current opportunities
* spread
* expected profit
* ROI
* trade size
* expiration

### Performance

* paper P/L
* number of opportunities
* simulated trades
* successful trades
* failed trades
* win rate
* average profit

---

## FR-022 — REST API

The backend shall expose REST endpoints for the dashboard and administration.

---

## FR-023 — Audit Logging

The system shall record important events:

* service startup
* configuration changes
* DEX connection failures
* RPC failures
* detected opportunities
* rejected opportunities
* simulations
* paper trades
* risk-rule rejections
* errors

---

# 7. Non-Functional Requirements

## NFR-001 — Availability

The monitoring system should target:

**99%+ monthly availability** during development.

Production targets may be increased later.

---

## NFR-002 — Latency

The system should minimize:

```text
market update
      ↓
opportunity detection
```

The exact target shall be established during benchmarking.

Phase 1 target:

**<500 ms internal processing time** for a single opportunity evaluation under normal load.

This does not represent blockchain transaction latency.

---

## NFR-003 — Scalability

The architecture shall support:

* additional DEXs
* additional token pairs
* multiple concurrent market streams
* additional trading strategies

without redesigning the core system.

---

## NFR-004 — Reliability

A temporary RPC or DEX failure shall not crash the entire application.

Services shall:

* retry
* back off
* reconnect
* log failures
* expose health status

---

## NFR-005 — Determinism

Given identical market data and configuration, the profitability engine shall produce the same result.

---

## NFR-006 — Observability

All services shall provide:

* structured JSON logs
* health endpoint
* readiness endpoint
* metrics

---

## NFR-007 — Testability

Business logic shall be testable without connecting to Solana.

The profitability engine shall support unit tests using mocked market data.

---

## NFR-008 — Maintainability

The codebase shall follow modular architecture:

```text
domain
application
infrastructure
api
```

DEX-specific logic shall not leak into core business logic.

---

## NFR-009 — Portability

The system shall run using Docker Compose on:

* local development workstation
* Linux server
* VPS
* on-premise Docker host

---

# 8. Database Schema

PostgreSQL shall be the system of record.

## 8.1 `dexes`

| Column       | Type      | Description        |
| ------------ | --------- | ------------------ |
| id           | UUID      | Primary key        |
| name         | VARCHAR   | DEX name           |
| adapter_name | VARCHAR   | Adapter identifier |
| enabled      | BOOLEAN   | Whether enabled    |
| created_at   | TIMESTAMP | Creation time      |
| updated_at   | TIMESTAMP | Update time        |

---

## 8.2 `tokens`

| Column       | Type      | Description         |
| ------------ | --------- | ------------------- |
| id           | UUID      | Primary key         |
| mint_address | VARCHAR   | Solana mint         |
| symbol       | VARCHAR   | Symbol              |
| name         | VARCHAR   | Token name          |
| decimals     | INTEGER   | Token decimals      |
| enabled      | BOOLEAN   | Monitoring enabled  |
| whitelisted  | BOOLEAN   | Allowed for trading |
| created_at   | TIMESTAMP | Creation time       |
| updated_at   | TIMESTAMP | Update time         |

Unique constraint:

```text
mint_address
```

---

## 8.3 `pools`

| Column           | Type      | Description         |
| ---------------- | --------- | ------------------- |
| id               | UUID      | Primary key         |
| dex_id           | UUID      | DEX                 |
| external_pool_id | VARCHAR   | DEX pool identifier |
| token_a_id       | UUID      | Token A             |
| token_b_id       | UUID      | Token B             |
| pool_type        | VARCHAR   | AMM/CLMM/etc.       |
| liquidity        | NUMERIC   | Estimated liquidity |
| enabled          | BOOLEAN   | Monitoring status   |
| last_updated_at  | TIMESTAMP | Last update         |

Unique constraint:

```text
dex_id + external_pool_id
```

---

## 8.4 `price_snapshots`

| Column        | Type      |
| ------------- | --------- |
| id            | BIGSERIAL |
| pool_id       | UUID      |
| token_in      | UUID      |
| token_out     | UUID      |
| input_amount  | NUMERIC   |
| output_amount | NUMERIC   |
| price         | NUMERIC   |
| slot          | BIGINT    |
| observed_at   | TIMESTAMP |

Indexes:

```text
pool_id
observed_at
token_in + token_out
```

---

## 8.5 `opportunities`

| Column          | Type      |
| --------------- | --------- |
| id              | UUID      |
| fingerprint     | VARCHAR   |
| input_token_id  | UUID      |
| output_token_id | UUID      |
| buy_dex_id      | UUID      |
| sell_dex_id     | UUID      |
| trade_amount    | NUMERIC   |
| gross_profit    | NUMERIC   |
| dex_fees        | NUMERIC   |
| network_fees    | NUMERIC   |
| priority_fees   | NUMERIC   |
| slippage_cost   | NUMERIC   |
| price_impact    | NUMERIC   |
| safety_buffer   | NUMERIC   |
| net_profit      | NUMERIC   |
| roi             | NUMERIC   |
| confidence      | NUMERIC   |
| status          | VARCHAR   |
| detected_at     | TIMESTAMP |
| expires_at      | TIMESTAMP |

Possible status:

```text
DETECTED
REJECTED
SIMULATED
PAPER_TRADED
EXPIRED
EXECUTED
FAILED
```

---

## 8.6 `simulations`

| Column          | Type      |
| --------------- | --------- |
| id              | UUID      |
| opportunity_id  | UUID      |
| success         | BOOLEAN   |
| expected_output | NUMERIC   |
| actual_output   | NUMERIC   |
| compute_units   | BIGINT    |
| error_code      | VARCHAR   |
| error_message   | TEXT      |
| simulated_at    | TIMESTAMP |

---

## 8.7 `trades`

| Column                | Type           |
| --------------------- | -------------- |
| id                    | UUID           |
| opportunity_id        | UUID           |
| mode                  | VARCHAR        |
| input_amount          | NUMERIC        |
| expected_output       | NUMERIC        |
| actual_output         | NUMERIC        |
| expected_profit       | NUMERIC        |
| actual_profit         | NUMERIC        |
| status                | VARCHAR        |
| transaction_signature | VARCHAR NULL   |
| execution_latency_ms  | INTEGER NULL   |
| created_at            | TIMESTAMP      |
| completed_at          | TIMESTAMP NULL |

For Phase 1:

```text
mode = PAPER
```

---

## 8.8 `risk_events`

| Column         | Type      |
| -------------- | --------- |
| id             | UUID      |
| opportunity_id | UUID NULL |
| rule           | VARCHAR   |
| threshold      | NUMERIC   |
| actual_value   | NUMERIC   |
| action         | VARCHAR   |
| created_at     | TIMESTAMP |

---

## 8.9 `bot_runs`

| Column                 | Type      |
| ---------------------- | --------- |
| id                     | UUID      |
| mode                   | VARCHAR   |
| started_at             | TIMESTAMP |
| stopped_at             | TIMESTAMP |
| status                 | VARCHAR   |
| opportunities_detected | INTEGER   |
| trades_simulated       | INTEGER   |

---

## 8.10 `system_events`

| Column     | Type      |
| ---------- | --------- |
| id         | BIGSERIAL |
| service    | VARCHAR   |
| level      | VARCHAR   |
| event_type | VARCHAR   |
| message    | TEXT      |
| metadata   | JSONB     |
| created_at | TIMESTAMP |

---

# 9. REST API

Base URL:

```text
/api/v1
```

## 9.1 Health

### GET `/health`

Returns service health.

Example:

```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "solana_rpc": "ok"
}
```

---

## 9.2 System status

### GET `/system/status`

Returns:

* bot status
* trading mode
* Solana cluster
* RPC status
* current slot
* uptime

---

## 9.3 DEXs

### GET `/dexes`

Returns configured DEXs.

### GET `/dexes/{id}`

Returns DEX details.

---

## 9.4 Tokens

### GET `/tokens`

Returns monitored tokens.

### POST `/tokens`

Adds a token to the monitoring list.

### PATCH `/tokens/{id}`

Updates token configuration.

### DELETE `/tokens/{id}`

Disables/removes a token.

---

## 9.5 Pools

### GET `/pools`

Returns monitored pools.

Query parameters:

```text
dex
token
enabled
```

---

## 9.6 Prices

### GET `/prices`

Returns current prices.

Query parameters:

```text
token
dex
pair
```

---

## 9.7 Opportunities

### GET `/opportunities`

Returns detected opportunities.

Parameters:

```text
status
dex
token
minimum_profit
minimum_roi
from
to
page
limit
```

### GET `/opportunities/{id}`

Returns detailed opportunity information.

---

## 9.8 Simulation

### POST `/opportunities/{id}/simulate`

Runs a simulation.

Response:

```json
{
  "success": true,
  "expectedOutput": "100.31",
  "estimatedProfit": "0.13"
}
```

---

## 9.9 Paper trading

### POST `/opportunities/{id}/paper-trade`

Creates a paper trade.

This endpoint shall never submit a blockchain transaction.

---

## 9.10 Performance

### GET `/performance`

Returns:

* total opportunities
* paper trades
* profitable trades
* losing trades
* total paper P/L
* average profit
* win rate
* ROI

---

## 9.11 Configuration

### GET `/config`

Returns non-secret runtime configuration.

Secrets shall never be returned.

---

# 10. Docker Architecture

The initial deployment shall use Docker Compose.

## Services

```text
nginx
api
market-data
arbitrage-engine
simulation-engine
dashboard
postgres
redis
```

Optional future services:

```text
execution-engine
prometheus
grafana
loki
```

---

## 10.1 `api`

Responsibilities:

* REST API
* configuration
* dashboard backend
* health checks

---

## 10.2 `market-data`

Responsibilities:

* Solana connection
* DEX adapters
* pool monitoring
* price collection

---

## 10.3 `arbitrage-engine`

Responsibilities:

* opportunity detection
* profitability calculations
* trade-size optimization
* risk evaluation

---

## 10.4 `simulation-engine`

Responsibilities:

* transaction simulation
* paper-trade processing
* simulation results

---

## 10.5 `dashboard`

Responsibilities:

* UI
* charts
* opportunities
* system status
* performance

---

## 10.6 `postgres`

Persistent database.

---

## 10.7 `redis`

Fast-changing state and cache.

---

## 10.8 `nginx`

Responsibilities:

* reverse proxy
* TLS termination in production
* routing
* optional rate limiting

---

# 11. Environment Variables

## Application

```text
NODE_ENV=development
APP_NAME=solana-arbitrage
APP_PORT=3000
LOG_LEVEL=info
```

## Solana

```text
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=
SOLANA_WS_URL=
SOLANA_COMMITMENT=confirmed
```

Production shall use a dedicated RPC provider rather than relying exclusively on a public endpoint.

---

## Database

```text
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=arbitrage
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_SSL=false
```

---

## Redis

```text
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
```

---

## Trading

```text
TRADING_MODE=paper

MIN_PROFIT_USD=0.05
MIN_ROI_PERCENT=0.10

MAX_TRADE_USD=100
MAX_SLIPPAGE_PERCENT=0.30
MIN_LIQUIDITY_USD=10000

MAX_QUOTE_AGE_MS=1000

MAX_DAILY_LOSS_USD=10
MAX_CONCURRENT_TRADES=1
```

---

## Market Monitoring

```text
PRICE_UPDATE_INTERVAL_MS=250
POOL_REFRESH_INTERVAL_MS=5000
OPPORTUNITY_SCAN_INTERVAL_MS=100
```

Exact values shall be tuned through benchmarking.

---

## DEX

```text
RAYDIUM_ENABLED=true
ORCA_ENABLED=false
```

Future DEXs shall use equivalent configuration.

---

## Security

```text
API_AUTH_ENABLED=true
JWT_SECRET=
API_RATE_LIMIT=100
```

---

## Wallet

For Phase 1:

```text
WALLET_ENABLED=false
```

No private key shall be required.

Future live-trading configuration shall use a secure key-management mechanism rather than placing a raw private key in source code.

Solana's current Kit documentation explicitly notes that headless applications should use a backend key-management service rather than a raw keypair in production.

---

# 12. Security Requirements

## SEC-001 — No private keys in source code

Private keys shall never be committed to Git.

---

## SEC-002 — No secrets in logs

The following shall never appear in logs:

* private keys
* seed phrases
* passwords
* API secrets
* database passwords
* authentication tokens

---

## SEC-003 — Paper mode by default

The default deployment shall be:

```text
TRADING_MODE=paper
```

---

## SEC-004 — Execution disabled

Phase 1 shall not contain an active transaction execution pathway.

If an execution service is present for architectural testing, it shall reject all live transactions.

---

## SEC-005 — Wallet isolation

When live trading is eventually enabled:

* use a dedicated wallet
* maintain limited balance
* never use the user's primary wallet
* implement spending limits
* implement emergency shutdown

---

## SEC-006 — Token allowlist

Only explicitly approved tokens shall be eligible for trading.

This is especially important because arbitrary Solana tokens may be malicious or economically unsafe.

---

## SEC-007 — DEX allowlist

Only explicitly approved DEX adapters shall be enabled.

---

## SEC-008 — Maximum trade amount

Every transaction shall pass:

```text
trade_amount <= MAX_TRADE_USD
```

---

## SEC-009 — Maximum daily loss

When:

```text
daily_loss >= MAX_DAILY_LOSS_USD
```

the trading system shall stop generating executable trades.

---

## SEC-010 — Kill switch

The system shall provide an emergency configuration or administrative mechanism to immediately disable trading.

---

## SEC-011 — API authentication

Administrative APIs shall require authentication.

---

## SEC-012 — API rate limiting

Administrative APIs shall have rate limits.

---

## SEC-013 — Database security

PostgreSQL shall:

* use a non-default password
* not expose its port publicly
* exist on an internal Docker network
* use least-privilege credentials

---

## SEC-014 — Redis security

Redis shall not be exposed directly to the Internet.

---

## SEC-015 — Container security

Containers should:

* run as non-root where practical
* use minimal base images
* have read-only filesystems where practical
* avoid unnecessary Linux capabilities
* receive regular dependency updates

---

# 13. Logging and Monitoring

Each service shall produce structured logs.

Example:

```json
{
  "timestamp": "2026-08-19T08:00:00Z",
  "service": "arbitrage-engine",
  "level": "info",
  "event": "OPPORTUNITY_DETECTED",
  "tokenPair": "SOL/USDC",
  "buyDex": "raydium",
  "sellDex": "orca",
  "tradeAmount": 100,
  "netProfit": 0.13,
  "roi": 0.13
}
```

---

# 14. Metrics

The system shall eventually expose:

```text
opportunities_detected_total
opportunities_rejected_total
opportunities_expired_total

simulations_total
simulation_success_total
simulation_failure_total

paper_trades_total
paper_profit_total

rpc_latency_ms
dex_quote_latency_ms
opportunity_processing_latency_ms

database_latency_ms

bot_uptime_seconds
```

---

# 15. Testing Requirements

## Unit Tests

Required components:

* profitability calculator
* fee calculator
* slippage calculator
* price comparison
* trade-size optimizer
* risk engine
* opportunity fingerprinting

---

## Integration Tests

Test:

* PostgreSQL
* Redis
* Solana RPC
* DEX adapter
* API

---

## End-to-End Test

Required Phase 1 scenario:

```text
Market data
    ↓
Price scanner
    ↓
Opportunity detected
    ↓
Profitability calculated
    ↓
Risk check
    ↓
Paper trade
    ↓
Database
    ↓
Dashboard
```

No real transaction shall be submitted.

---

# 16. Phase 1 Development Backlog

## Sprint 1 — Project Foundation

### P1-001 — Repository

Create monorepo structure:

```text
/apps
    /api
    /dashboard
    /market-data
    /arbitrage-engine
    /simulation-engine

/packages
    /solana
    /dex-adapters
    /domain
    /database
    /config
    /logging
    /testing
```

### P1-002 — TypeScript configuration

Implement:

* TypeScript
* ESLint
* Prettier
* strict mode

### P1-003 — Docker

Create Docker Compose for:

```text
api
market-data
arbitrage-engine
simulation-engine
dashboard
postgres
redis
nginx
```

### P1-004 — Environment configuration

Implement validated environment configuration.

---

# Sprint 2 — Database

### P1-005 — PostgreSQL

Create database container.

### P1-006 — ORM

Recommended:

```text
Prisma
```

or another TypeScript-compatible ORM.

### P1-007 — Initial migrations

Implement:

* dexes
* tokens
* pools
* price_snapshots
* opportunities
* simulations
* trades
* risk_events
* bot_runs
* system_events

### P1-008 — Database indexes

Create indexes for:

* token pairs
* pool IDs
* timestamps
* opportunity status
* fingerprints

---

# Sprint 3 — Solana Connectivity

### P1-009 — Solana client

Implement `@solana/kit`.

### P1-010 — RPC health

Implement:

```text
getSlot
```

and RPC latency measurement.

### P1-011 — Subscription layer

Implement the required Solana subscriptions for the selected market-data strategy.

### P1-012 — Cluster switching

Support:

```text
devnet
mainnet-beta
```

through configuration.

---

# Sprint 4 — DEX Adapter

### P1-013 — DEX interface

Create:

```typescript
interface DexAdapter {
    getMarkets(): Promise<Market[]>;
    getPool(): Promise<Pool>;
    getQuote(): Promise<Quote>;
    getLiquidity(): Promise<Liquidity>;
}
```

### P1-014 — Raydium adapter

Implement Raydium market/pool/quote integration.

Raydium currently documents its Trade API as an appropriate path for backend/bot integrations and its TypeScript SDK for applications requiring more control.

### P1-015 — Second DEX adapter

Implement a second DEX after validating its current API/SDK and liquidity suitability.

---

# Sprint 5 — Market Data

### P1-016 — Token registry

Implement configurable token allowlist.

### P1-017 — Pool registry

Implement pool discovery and persistence.

### P1-018 — Price collection

Implement price snapshots.

### P1-019 — Redis market cache

Cache current:

```text
price
liquidity
quote
slot
timestamp
```

---

# Sprint 6 — Arbitrage Engine

### P1-020 — Price comparison

Implement cross-DEX comparison.

### P1-021 — Direction detection

Evaluate both:

```text
A → B
B → A
```

### P1-022 — Trade-size optimization

Evaluate configured trade sizes.

### P1-023 — Profitability engine

Implement:

```text
gross profit
DEX fees
network fees
priority fees
slippage
price impact
safety buffer
net profit
ROI
```

### P1-024 — Risk engine

Implement all Phase 1 risk rules.

---

# Sprint 7 — Paper Trading

### P1-025 — Opportunity persistence

Persist every qualifying opportunity.

### P1-026 — Opportunity expiration

Implement stale quote protection.

### P1-027 — Paper trade engine

Simulate execution without sending transactions.

### P1-028 — Performance calculation

Calculate:

```text
paper P/L
win rate
average profit
average loss
ROI
```

---

# Sprint 8 — API

### P1-029 — REST API

Implement:

```text
GET /api/v1/health
GET /api/v1/system/status

GET /api/v1/dexes
GET /api/v1/tokens
GET /api/v1/pools
GET /api/v1/prices

GET /api/v1/opportunities
GET /api/v1/opportunities/:id

POST /api/v1/opportunities/:id/simulate
POST /api/v1/opportunities/:id/paper-trade

GET /api/v1/performance
```

### P1-030 — Authentication

Implement authentication for administrative endpoints.

---

# Sprint 9 — Dashboard

### P1-031 — System dashboard

Display:

* bot status
* cluster
* RPC
* uptime

### P1-032 — Opportunity dashboard

Display:

* pair
* buy DEX
* sell DEX
* spread
* trade size
* net profit
* ROI
* age

### P1-033 — Performance dashboard

Display:

* paper P/L
* trades
* success rate
* average profit
* rejected opportunities

---

# Sprint 10 — Testing

### P1-034 — Unit tests

Target:

**80%+ coverage for core business logic.**

### P1-035 — Integration tests

Test:

* PostgreSQL
* Redis
* RPC
* DEX adapter

### P1-036 — End-to-end test

Verify:

```text
market data
→ opportunity
→ profitability
→ risk
→ paper trade
→ database
→ API
→ dashboard
```

---

# 17. Phase 1 Acceptance Criteria

Phase 1 shall be considered complete when:

### AC-001

The system can connect to Solana.

### AC-002

The system can retrieve market information from at least two DEX sources.

### AC-003

The system can identify price differences.

### AC-004

The system can calculate realistic estimated net profitability.

### AC-005

The system evaluates multiple trade sizes.

### AC-006

The system rejects opportunities violating risk rules.

### AC-007

The system records opportunities in PostgreSQL.

### AC-008

The system can run paper trades continuously.

### AC-009

The dashboard displays live opportunities.

### AC-010

The system survives temporary RPC/DEX failures.

### AC-011

Automated tests cover core business logic.

### AC-012

No real-money transaction can be submitted in the Phase 1 configuration.

---

# 18. Phase 1 Operational Flow

The final Phase 1 runtime flow shall be:

```text
┌──────────────────────┐
│     Solana RPC       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│    Market Data       │
│      Service         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│     DEX Adapters     │
│                      │
│ Raydium + DEX #2     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Arbitrage Detector   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Profitability Engine │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│      Risk Engine     │
└──────────┬───────────┘
           │
       profitable?
        /       \
      NO         YES
      │           │
      ▼           ▼
    STORE     SIMULATE
                  │
                  ▼
             PAPER TRADE
                  │
                  ▼
             PostgreSQL
                  │
                  ▼
              Dashboard
```

---

# 19. Future Architecture — Live Trading

Live execution shall **not** be part of the initial implementation.

When Phase 1 demonstrates sufficient viability, the architecture may be extended:

```text
                    OPPORTUNITY
                         │
                         ▼
                    PROFITABILITY
                         │
                         ▼
                       RISK
                         │
                         ▼
                    SIMULATION
                         │
                    passes?
                         │
                         ▼
                 ┌───────────────┐
                 │ EXECUTION     │
                 │ SERVICE       │
                 └───────┬───────┘
                         │
                         ▼
                 SECURE SIGNER
                         │
                         ▼
                      SOLANA
                         │
                         ▼
                   VERIFICATION
                         │
                         ▼
                   TRADE LEDGER
```

The execution service shall be isolated from the market-data and dashboard services.

---

# 20. Future Phase Roadmap

## Phase 2 — Advanced Paper Trading

* historical data collection
* backtesting
* route optimization
* improved price-impact modeling
* execution-latency measurement
* failure-rate analysis
* strategy comparison

## Phase 3 — Devnet Execution

* transaction construction
* signing
* submission
* confirmation
* failure handling

## Phase 4 — Controlled Mainnet Execution

* dedicated wallet
* very small capital
* hard risk limits
* kill switch
* transaction monitoring

## Phase 5 — Optimization

* RPC optimization
* priority-fee optimization
* faster quote acquisition
* better route selection
* additional DEXs
* advanced liquidity analysis

## Phase 6 — Advanced On-Chain Execution

Only if justified by measured performance:

* custom Solana program
* atomic multi-step execution
* CPI integrations
* advanced execution strategies

A custom on-chain program should not be introduced merely because it is technically interesting. Raydium's current documentation describes custom CPI programs as appropriate when trades need atomic composition with other on-chain state changes; therefore, this should be treated as an optimization/advanced-execution phase rather than an MVP requirement.

---

# 21. Important Design Decision

The system should **not attempt to reproduce the viral "$1 → $400,000" claim as its acceptance criterion**.

The engineering acceptance criterion is:

> Can the system identify arbitrage opportunities that remain profitable after realistic execution costs, and can those opportunities be reproduced consistently through paper trading and eventually controlled live execution?

The first measurable target should therefore be:

```text
OPPORTUNITY COUNT
        ↓
VALID OPPORTUNITY COUNT
        ↓
PAPER TRADE COUNT
        ↓
PROFITABLE PAPER TRADES
        ↓
REALISTIC NET P/L
        ↓
EXECUTION SUCCESS RATE
        ↓
SUSTAINABILITY
```

A large number of detected opportunities with negative actual/paper profitability should be considered a **successful finding**, because it tells us that the strategy needs improvement rather than falsely reporting theoretical profits.

---

# 22. Technology Baseline

The initial implementation shall use:

```text
Frontend:
React / Next.js

Backend:
Node.js + TypeScript

Solana:
@solana/kit

DEX:
Raydium adapter
Second DEX adapter

API:
REST

Database:
PostgreSQL

Cache:
Redis

Container:
Docker / Docker Compose

Reverse Proxy:
Nginx

Testing:
Vitest/Jest + integration tests

CI:
GitHub Actions

Monitoring:
Structured logs initially
Prometheus/Grafana later
```

Raydium's current documentation notes that its TypeScript SDK is a full-control integration option, while its Trade API is intended for backend/bot use cases; the adapter abstraction should therefore allow the implementation to use whichever interface proves more appropriate for each specific DEX.

---

# 23. Definition of Done

The project shall not be considered ready for live trading merely because the software is functioning.

Before live execution is considered, the following must be demonstrated:

* [ ] Stable market-data collection
* [ ] Reliable DEX integrations
* [ ] Correct profitability calculations
* [ ] Realistic slippage calculations
* [ ] Correct fee calculations
* [ ] Paper-trading history
* [ ] Historical/backtesting evidence
* [ ] Risk controls
* [ ] Transaction simulation
* [ ] Wallet isolation
* [ ] Kill switch
* [ ] Maximum-loss protection
* [ ] Comprehensive transaction logging
* [ ] Automated tests
* [ ] Monitoring
* [ ] Failure recovery
* [ ] Manual emergency shutdown
* [ ] Security review

**No live trading should be enabled until all required controls have passed testing.**
