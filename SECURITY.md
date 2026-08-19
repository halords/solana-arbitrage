# Security Policy & Hardening Guidelines (`SECURITY.md`)

This document establishes the security policies, threat modeling, operational safety controls, and hardening standards for the **Solana Automated Arbitrage Platform** according to Section 12 of the Software Requirements Specification (SRS).

---

## 1. 🛡️ Core Security Requirements

### SEC-001: Zero Private Keys in Source Code
- Under no circumstances shall raw keypairs, seed phrases, or private keys be committed to source control or embedded in build artifacts.
- In Phase 1, the platform operates in observation/paper-trading mode (`TRADING_MODE=paper`) and does not require or load private keys.
- For future phases, headless key management services (KMS / HashiCorp Vault / AWS Secrets Manager) or dedicated encrypted hardware signers will be used.

### SEC-002: Zero Secrets in Logs
- All application logging is routed through `@solana-arbitrage/logging`.
- Automated serializers mask sensitive keys matching `*key*`, `*secret*`, `*password*`, `*token*`, `*auth*`, `*signature*`.
- Unhandled error handlers strip request headers and authorization payloads before logging.

### SEC-003: Default Safe Operating Mode
- The system defaults to `TRADING_MODE=paper` upon every startup.
- Live trading activation requires explicit environment override, authentication, and passing all pre-flight risk checks.

### SEC-004: Execution Pathway Isolation
- Opportunity detection and market monitoring services have zero network access or code linkage to transaction submission pipelines.
- Paper trading workers record simulated ledger entries directly to PostgreSQL without touching Solana submission RPCs.

### SEC-005: Token & DEX Whitelisting
- Arbitrage scanning is strictly constrained to explicitly approved token mints (`whitelisted=true`) and verified DEX adapters.
- Prevents honeypots, malicious transfer-fee tokens, and unverified pools from entering the detection loop.

---

## 2. 🎛️ Risk Engine Guardrails

The Risk Engine operates as an immutable gatekeeper:

| Control | Environment Variable | Default Constraint | Action on Breach |
| :--- | :--- | :--- | :--- |
| **Max Trade Size** | `MAX_TRADE_USD` | `$100.00` | Opportunity Rejected |
| **Min Net Profit** | `MIN_PROFIT_USD` | `$0.05` | Opportunity Rejected |
| **Min ROI** | `MIN_ROI_PERCENT` | `0.10%` | Opportunity Rejected |
| **Max Slippage** | `MAX_SLIPPAGE_PERCENT` | `0.30%` | Opportunity Rejected |
| **Min Pool Liquidity** | `MIN_LIQUIDITY_USD` | `$10,000.00` | Pool Skipped |
| **Max Daily Loss** | `MAX_DAILY_LOSS_USD` | `$10.00` | Emergency System Halt |
| **Quote Expiration** | `MAX_QUOTE_AGE_MS` | `1000 ms` | Opportunity Discarded |

---

## 3. 🚨 Emergency Kill Switch

- A hardware/software kill switch endpoint is exposed via `POST /api/v1/system/kill-switch` requiring administrative JWT authentication.
- When triggered:
  1. Immediately halts all active market data scrapers.
  2. Discards any pending opportunities in Redis.
  3. Emits high-priority audit alerts to PostgreSQL `system_events`.
  4. Transitions bot status to `HALTED`.

---

## 4. 🐳 Infrastructure & Container Hardening

### Network Isolation
- PostgreSQL and Redis containers do **not** publish external ports to the host in production (`expose` instead of `ports`).
- All internal microservices communicate over an isolated Docker bridge network (`arbitrage-net`).

### Non-Root Execution
- All Dockerfiles run container processes as non-root users (`USER node` or `USER nonroot`).
- Root filesystems are mounted read-only where practical.

### Dependencies & Vulnerability Management
- All dependencies must pass regular `npm audit` and vulnerability scanning in CI.
- Package versions are pinned with exact versions in `package.json` to prevent supply chain injection.

---

## 5. 🔍 Vulnerability Disclosure & Reporting

If you discover a security vulnerability in this project:
1. Do NOT open a public GitHub issue.
2. Report the vulnerability privately to the project security maintainers.
3. Include detailed steps to reproduce, affected components, and potential impact.
