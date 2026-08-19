# 🚀 Operational Runbook: Running the Solana Arbitrage Platform in Paper Trading Mode

This guide walks you through building, launching, and continuously running the entire Solana Arbitrage system throughout the day.

---

## 🛠️ Step-by-Step Execution Guide

### Step 1: Start Background Services (PostgreSQL & Redis)
If Docker is installed on your machine, start the database and cache cluster:
```powershell
docker compose up -d
```
> [!NOTE]
> If running without Docker, ensure local PostgreSQL is running on port `5432` and Redis on `6379`.

### Step 2: Database Initialization & Seeding
Push the Prisma relational schema and seed default DEX adapters and whitelisted tokens (SOL, USDC, USDT):
```powershell
npx prisma db push --schema=packages/database/prisma/schema.prisma
npx tsx packages/database/src/seed.ts
```

### Step 3: Run the Continuous Arbitrage & Paper Trading Engine
Launch the backend engine (Market Poller $\to$ Arbitrage Detector $\to$ Profitability Math $\to$ Risk Engine $\to$ Paper Trader $\to$ REST API):
```powershell
npm run dev
```
**What happens in this process:**
1. Connects to Solana Devnet RPC and starts listening to real-time slot notifications.
2. Continuously polls quotes across Raydium AMM and Orca Whirlpool pools.
3. Automatically executes simulated paper trades (`mode = 'PAPER'`) for all qualifying opportunities meeting net profit and ROI criteria.
4. Exposes the REST API on `http://localhost:3000`.

### Step 4: Launch the Real-Time Web Dashboard (in a second terminal)
To view live opportunities, win rates, and P/L graphs throughout the day:
```powershell
npm run dev:dashboard
```
Open **`http://localhost:3000`** in your browser to view:
- **Live Arbitrage Opportunity Stream**
- **Simulated Paper Trading P/L & Win Rate %**
- **Solana Cluster Slot Height & RPC Latency Monitor**
- **Emergency Kill-Switch Button**
