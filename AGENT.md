# AI Agent & Developer Operating Guide (`AGENT.md`)

This document defines the strict operating rules, architectural boundaries, safety constraints, and development guidelines for AI coding agents and engineers contributing to the **Solana Automated Arbitrage Platform**.

---

## 🚨 Non-Negotiable Safety Directives

### 1. Zero Live Money Execution in Phase 1
- **NEVER** introduce code that attempts to sign and submit live transactions to Solana Mainnet with real funds in Phase 1.
- `TRADING_MODE` MUST default to `paper`.
- No wallet keypairs or private keys may be created, loaded, or held in memory for trading execution.

### 2. Zero Secrets Policy
- **NEVER** hardcode RPC API keys, database credentials, JWT secrets, or private keys.
- All secrets MUST be injected via environment variables validated by `@solana-arbitrage/config`.
- All logging MUST pass through `@solana-arbitrage/logging`, which enforces automated pattern-based secret redaction.

### 3. Determinism Over Probabilistic Logic
- **NEVER** use LLM or AI model outputs to decide whether to execute a trade, determine trade size, or calculate profitability.
- Arbitrage detection, fee computation, and risk checks MUST be pure, deterministic, and verifiable functions.

---

## 🏛️ Architectural Guardrails

### Layer Separation
Adhere strictly to the clean modular separation defined in the SRS:
```
Market Data ──▶ Opportunity Engine ──▶ Profitability Engine ──▶ Risk Engine ──▶ Simulation / Paper Trade ──▶ PostgreSQL
```
- **DEX Logic:** Isolated in `packages/dex-adapters`. Never leak DEX-specific math or structures into the core opportunity engine.
- **Solana RPC:** Isolated in `packages/solana`.
- **Domain Types:** Centralized in `packages/domain`.
- **Math Precision:** Use `BigInt` for on-chain lamports/token base units and `Decimal.js` for USD calculations. Native IEEE 754 floats (`number` for calculations with currency) are strictly prohibited in financial math.

---

## 🛠️ Development & Quality Requirements

Before committing or completing any task, the following quality gates MUST pass:
1. **Type Checking:** `npx tsc --noEmit` must pass with zero errors across all workspaces.
2. **Linting:** `npm run lint` must pass with zero warnings or errors.
3. **Unit Tests:** All newly created financial calculators, adapter mappers, and risk rules must have corresponding unit tests.
4. **Imports:** Use explicit typescript workspace imports (`@solana-arbitrage/domain`, `@solana-arbitrage/config`, etc.).

---

## 📋 Standard Workflow for Features & Fixes

1. **Verify Documentation & Requirements:** Check [SRS.md](file:///c:/Users/ADMIN-LPT-022/Desktop/solana-arbitrage/SRS.md) and [ROADMAP.md](file:///c:/Users/ADMIN-LPT-022/Desktop/solana-arbitrage/ROADMAP.md) before implementing.
2. **Consult Architectural Decisions:** Review [DECISION.md](file:///c:/Users/ADMIN-LPT-022/Desktop/solana-arbitrage/DECISION.md). If introducing a major pattern change, record an ADR.
3. **Follow Code Conventions:** Adhere strictly to [CONVENTIONS.md](file:///c:/Users/ADMIN-LPT-022/Desktop/solana-arbitrage/CONVENTIONS.md).
4. **Implement with Strict Types:** No `any` types allowed.
5. **Run Quality Checks:** Run `npm run lint` and `npx tsc --noEmit`.
