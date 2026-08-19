# ⚡ Solana Automated Arbitrage Research & Trading Platform

A high-frequency Solana DEX arbitrage monitoring, simulation, and deterministic paper trading platform built with TypeScript, `@solana/kit`, Fastify, Next.js 14, PostgreSQL, and Redis.

---

## 📌 Architecture Overview

```
                          ┌────────────────────────┐
                          │   Solana Blockchain    │
                          │ (Devnet / Mainnet-Beta)│
                          └───────────┬────────────┘
                                      │ RPC / WebSocket Slot Streams
                                      ▼
                        ┌───────────────────────────┐
                        │   @solana-arbitrage/      │
                        │         solana            │
                        └─────────────┬─────────────┘
                                      │
               ┌──────────────────────┴──────────────────────┐
               │                                             │
               ▼                                             ▼
┌───────────────────────────────┐             ┌───────────────────────────────┐
│     @solana-arbitrage/        │             │     @solana-arbitrage/        │
│        dex-adapters           │             │         market-data           │
│   (Raydium AMM / Orca CLMM)   │             │   (Token & Pool Registry)     │
└──────────────┬────────────────┘             └──────────────┬────────────────┘
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      │ Real-time Quotes
                                      ▼
                        ┌───────────────────────────┐
                        │   @solana-arbitrage/      │
                        │     arbitrage-engine      │
                        │  (Profitability & Risk)   │
                        └─────────────┬─────────────┘
                                      │ Qualified Opportunities
                                      ▼
                        ┌───────────────────────────┐
                        │   @solana-arbitrage/      │
                        │    simulation-engine      │
                        │  (Deterministic Paper)    │
                        └─────────────┬─────────────┘
                                      │
               ┌──────────────────────┴──────────────────────┐
               │                                             │
               ▼                                             ▼
┌───────────────────────────────┐             ┌───────────────────────────────┐
│     @solana-arbitrage/        │             │     @solana-arbitrage/        │
│          database             │             │             api               │
│   (PostgreSQL + Redis Lock)   │             │   (Fastify REST & Kill Switch)│
└───────────────────────────────┘             └──────────────┬────────────────┘
                                                             │
                                                             ▼
                                              ┌───────────────────────────────┐
                                              │     @solana-arbitrage/        │
                                              │          dashboard            │
                                              │   (Next.js 14 Web Frontend)   │
                                              └───────────────────────────────┘
```

---

## 📦 Monorepo Structure

```
├── apps/
│   ├── api/                 # Fastify REST backend & core arbitrage runner
│   ├── arbitrage-engine/    # Bidirectional opportunity detector & risk rules
│   ├── dashboard/           # Next.js 14 glassmorphism real-time monitoring UI
│   ├── market-data/         # Multi-DEX quote polling engine & token registry
│   └── simulation-engine/   # Compute budget simulator & paper trade ledger
├── packages/
│   ├── config/              # Zod environment variable parsing and validation
│   ├── database/            # Prisma schema (10 domain models) & Redis caching
│   ├── dex-adapters/        # Raydium AMM & Orca Whirlpool adapter implementations
│   ├── domain/              # Shared pure domain models and interfaces
│   ├── logging/             # Pino logger with automated secret redaction
│   ├── solana/              # @solana/kit RPC client & WebSocket subscription manager
│   └── testing/             # End-to-end integration and lifecycle test suite
├── docker-compose.yml       # PostgreSQL 16 + Redis 7 infrastructure
└── ROADMAP.md               # Phase 1-6 Engineering Roadmap
```

---

## 🛡️ Key Security & Safety Rules

- **Zero Real Funds in Phase 1:** All executions are strictly simulated in `TRADING_MODE=paper`.
- **Secret Redaction:** Logs automatically redact private keys, tokens, passwords, and JWTs.
- **Strict Risk Bounds:** Configurable max trade caps (`MAX_TRADE_USD`), slippage limits (`MAX_SLIPPAGE_PERCENT`), and quote expiration windows (`MAX_QUOTE_AGE_MS=1000`).
- **Emergency Kill Switch:** Instant halt available via API endpoint `POST /api/v1/system/kill-switch` or the Dashboard button.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v20.x or v22.x
- **Docker**: For PostgreSQL and Redis (or local instances)

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Infrastructure (Postgres & Redis)
```bash
docker compose up -d
```

### 4. Setup Database
```bash
npx prisma db push --schema=packages/database/prisma/schema.prisma
npx tsx packages/database/src/seed.ts
```

### 5. Launch the Platform (Paper Trading Mode)
In Terminal 1 (Backend Core & Market Poller):
```bash
npm run dev
```

In Terminal 2 (Web Dashboard):
```bash
npm run dev:dashboard
```
Open **`http://localhost:3000`** in your browser.

---

## 🧪 Testing & Verification

```bash
# Run all unit and integration test suites
npm test

# Run strict TypeScript compiler verification
npx tsc --noEmit

# Run strict ESLint & security lint rules
npm run lint
```

---

## 📄 License
Private & Proprietary. All rights reserved.
