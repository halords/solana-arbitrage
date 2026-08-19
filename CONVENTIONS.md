# Code Conventions & Engineering Standards (`CONVENTIONS.md`)

This document outlines the mandatory engineering standards, TypeScript formatting rules, project structure, financial mathematics handling, error management, and security practices for the **Solana Automated Arbitrage Platform**.

---

## 1. 🏗️ Code Organization & Monorepo Structure

The workspace follows a clean, modular monorepo structure:

```text
solana-arbitrage/
├── apps/
│   ├── api/                # REST & WebSocket backend API (Fastify)
│   ├── arbitrage-engine/   # Opportunity detection, fee & risk analysis
│   ├── dashboard/          # Next.js / React management dashboard
│   ├── market-data/        # Solana RPC & DEX pool data scraper
│   └── simulation-engine/  # Transaction simulation & paper trading ledger
├── packages/
│   ├── config/             # Zod-validated environment config schemas
│   ├── database/           # Prisma client, migrations & Postgres models
│   ├── dex-adapters/       # Raydium, Orca, and future DEX integrations
│   ├── domain/             # Core domain models, interfaces, math helpers
│   ├── logging/            # Pino structured JSON logger with secret redaction
│   ├── solana/             # @solana/kit RPC clients and helpers
│   └── testing/            # Shared test factories, mock pools & fixtures
├── docker-compose.yml      # Multi-service local & production container config
├── package.json            # Root workspace scripts & dependencies
└── tsconfig.json           # Root TypeScript compiler options
```

---

## 2. 💎 TypeScript Strictness Rules

Every TypeScript file MUST adhere to the strictest compiler guidelines:

- **No `any` Types:** Never use `any`. Use `unknown` with type narrowing (e.g. `zod` schemas or type guards) if the type is indeterminate.
- **Explicit Return Types:** All exported functions, service methods, and API handlers MUST explicitly declare their return type.
- **Strict Null Checks:** Always handle `null` and `undefined` explicitly. Optional chaining (`?.`) and nullish coalescing (`??`) are required over non-null assertions (`!`).
- **Immutable Data Structures:** Prefer `readonly` properties on domain interfaces and `const` declarations.

```typescript
// ❌ BAD
export function calculateProfit(quoteA: any, quoteB: any) {
  return quoteB.price - quoteA.price;
}

// ✅ GOOD
export interface ProfitEvaluation {
  readonly grossProfitUsd: Decimal;
  readonly netProfitUsd: Decimal;
  readonly roiPercent: Decimal;
  readonly isProfitable: boolean;
}

export function calculateProfit(
  quoteA: Readonly<Quote>,
  quoteB: Readonly<Quote>,
  fees: Readonly<FeeStructure>
): ProfitEvaluation {
  // Pure, deterministic Decimal.js calculation
}
```

---

## 3. 🔢 Financial Precision & Mathematics Standards

To eliminate floating point rounding errors in cryptocurrency and fiat calculations:

1. **Token Amounts & Lamports:** MUST be stored and manipulated as `bigint` (representing raw on-chain integer base units, e.g. $1\text{ SOL} = 1,000,000,000\text{ lamports}$).
2. **USD Prices, Fees & ROI:** MUST be calculated using `Decimal.js` (or converted integer micro-units).
3. **Division Operations:** Always specify explicit precision and rounding modes (`Decimal.ROUND_HALF_UP` or `Decimal.ROUND_DOWN` for conservative profit estimates).

---

## 4. 🛡️ Error Handling & Result Pattern

- **No Uncaught Exceptions:** All async operations (RPC queries, DB queries, HTTP calls) must be wrapped in `try/catch` or use a `Result<T, E>` pattern.
- **Custom Domain Errors:** Extend standard error classes with structured context (e.g., `StaleQuoteError`, `RiskLimitExceededError`, `RpcConnectionError`).
- **Never Throw Raw Strings:** Always throw instances of `Error` with descriptive codes.

```typescript
export class StaleQuoteError extends Error {
  public readonly code = 'ERR_STALE_QUOTE';
  constructor(
    public readonly quoteAgeMs: number,
    public readonly maxAllowedMs: number
  ) {
    super(`Quote expired: age ${quoteAgeMs}ms exceeds max ${maxAllowedMs}ms`);
    Object.setPrototypeOf(this, StaleQuoteError.prototype);
  }
}
```

---

## 5. 📜 Structured Logging Conventions

All logs must use the centralized logger from `@solana-arbitrage/logging`:

- Log levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`.
- Pass structured objects as the first argument, followed by a clear message string.
- Never log sensitive fields (private keys, API tokens, passwords, authorization headers).

```typescript
// ✅ GOOD
logger.info(
  {
    fingerprint: opp.fingerprint,
    tokenPair: `${opp.inputToken}/${opp.outputToken}`,
    netProfitUsd: opp.netProfitUsd.toFixed(4),
    roi: opp.roiPercent.toFixed(2),
  },
  'Arbitrage opportunity identified'
);
```

---

## 6. 🧪 Testing Standards

- **Unit Tests:** Mandatory for all formulas in `packages/domain` (profit, fees, slippage, risk limits).
- **Integration Tests:** Use mock RPC responses and isolated test databases.
- **Zero Flaky Tests:** No arbitrary `sleep()` or non-deterministic timer waits in test suites.

---

## 7. 🔒 Security & Git Hygiene

- **`.gitignore` Rules:** Keep `.env`, `.env.local`, `*.key`, `id.json`, and all keypair JSON files strictly ignored.
- **Commit Messages:** Follow Conventional Commits:
  - `feat:` (New feature)
  - `fix:` (Bug fix)
  - `refactor:` (Refactoring code without functional changes)
  - `test:` (Adding or updating tests)
  - `docs:` (Documentation changes)
  - `chore:` (Build/tooling updates)
