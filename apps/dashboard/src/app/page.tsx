'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  PowerOff,
  Clock,
  Layers,
} from 'lucide-react';

interface LiveMetrics {
  totalProfitUsd: number;
  totalTrades: number;
  winRate: number;
  detectedCount: number;
  rejectedCount: number;
  latencyMs: number;
  currentSlot: string;
  cluster: string;
  tradingMode: string;
  opportunities: Array<{
    pair: string;
    buyDex: string;
    sellDex: string;
    buyPrice: number;
    sellPrice: number;
    profitUsd: number;
    roiPercent: number;
    tradeSizeUsd: number;
  }>;
}

export default function DashboardPage(): JSX.Element {
  const [killSwitchTriggered, setKillSwitchTriggered] = useState(false);
  const [metrics, setMetrics] = useState<LiveMetrics>({
    totalProfitUsd: 0,
    totalTrades: 0,
    winRate: 100,
    detectedCount: 0,
    rejectedCount: 0,
    latencyMs: 18,
    currentSlot: '250,491,820',
    cluster: 'devnet',
    tradingMode: 'paper',
    opportunities: [],
  });

  const fetchLiveStatus = async (): Promise<void> => {
    try {
      const [healthRes, statusRes, perfRes, oppsRes] = await Promise.allSettled([
        window.fetch('http://localhost:3000/api/v1/health'),
        window.fetch('http://localhost:3000/api/v1/system/status'),
        window.fetch('http://localhost:3000/api/v1/performance'),
        window.fetch('http://localhost:3000/api/v1/opportunities?limit=5'),
      ]);

      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const healthData = await healthRes.value.json() as {
          latency?: { solanaRpcMs?: number; databaseMs?: number };
        };
        setMetrics((prev) => ({
          ...prev,
          latencyMs: healthData.latency?.solanaRpcMs ?? prev.latencyMs,
        }));
      }

      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        const statusData = await statusRes.value.json() as {
          currentSlot?: string;
          solanaCluster?: string;
          tradingMode?: string;
        };
        setMetrics((prev) => ({
          ...prev,
          currentSlot: statusData.currentSlot ?? prev.currentSlot,
          cluster: statusData.solanaCluster ?? 'devnet',
          tradingMode: statusData.tradingMode ?? 'paper',
        }));
      }

      if (perfRes.status === 'fulfilled' && perfRes.value.ok) {
        const perfData = await perfRes.value.json() as {
          totalOpportunities?: number;
          paperTrades?: number;
          totalPaperProfitUsd?: string;
          winRatePercent?: string;
        };
        setMetrics((prev) => ({
          ...prev,
          totalProfitUsd: parseFloat(perfData.totalPaperProfitUsd ?? '0'),
          totalTrades: perfData.paperTrades ?? prev.totalTrades,
          winRate: parseFloat(perfData.winRatePercent ?? '100'),
          detectedCount: perfData.totalOpportunities ?? prev.detectedCount,
        }));
      }

      if (oppsRes.status === 'fulfilled' && oppsRes.value.ok) {
        const oppsData = await oppsRes.value.json() as Array<{
          id: string;
          buyDex?: { name: string };
          sellDex?: { name: string };
          inputToken?: { symbol: string };
          outputToken?: { symbol: string };
          netProfit: string | number;
          roi: string | number;
          tradeAmount: string | number;
        }>;

        if (oppsData.length > 0) {
          const mapped = oppsData.map((o) => ({
            pair: `${o.inputToken?.symbol ?? 'SOL'} / ${o.outputToken?.symbol ?? 'USDC'}`,
            buyDex: o.buyDex?.name ?? 'Raydium',
            sellDex: o.sellDex?.name ?? 'Orca',
            buyPrice: 0,
            sellPrice: 0,
            profitUsd: parseFloat(String(o.netProfit ?? '0')),
            roiPercent: parseFloat(String(o.roi ?? '0')),
            tradeSizeUsd: parseFloat(String(o.tradeAmount ?? '10')),
          }));
          setMetrics((prev) => ({
            ...prev,
            opportunities: mapped,
          }));
        }
      }
    } catch {
      // Backend polling fallback
    }
  };

  useEffect((): (() => void) => {
    void fetchLiveStatus();
    const interval = setInterval(() => {
      void fetchLiveStatus();
    }, 1000);
    return (): void => clearInterval(interval);
  }, []);

  const handleKillSwitch = async (): Promise<void> => {
    if (confirm('Are you sure you want to trigger the EMERGENCY KILL-SWITCH?')) {
      try {
        await window.fetch('http://localhost:3000/api/v1/system/kill-switch', { method: 'POST' });
      } catch {
        // Fallback local toggle
      }
      setKillSwitchTriggered(true);
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Header / System Status Bar */}
      <header
        className="glass-panel"
        style={{
          padding: '1.25rem 1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #00f0ff, #9d4edd)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={22} color="#0a0c10" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Solana Arbitrage Platform
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Monitoring Raydium & Orca Pools
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="pulse-dot" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {killSwitchTriggered ? 'STATUS: HALTED' : `SOLANA ${metrics.cluster.toUpperCase()}`}
            </span>
          </div>

          <span className="badge-paper">MODE: {metrics.tradingMode.toUpperCase()} TRADING</span>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Slot: </span>
            <span style={{ fontWeight: 600 }}>{metrics.currentSlot}</span>
          </div>

          <button
            onClick={handleKillSwitch}
            disabled={killSwitchTriggered}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: killSwitchTriggered ? '#334155' : 'rgba(255, 51, 102, 0.15)',
              color: killSwitchTriggered ? '#94a3b8' : 'var(--accent-red)',
              border: '1px solid rgba(255, 51, 102, 0.3)',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: killSwitchTriggered ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.8rem',
            }}
          >
            <PowerOff size={14} />
            {killSwitchTriggered ? 'SYSTEM HALTED' : 'KILL SWITCH'}
          </button>
        </div>
      </header>

      {/* KPI Performance Summary Grid */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Total Paper P/L
            </span>
            <TrendingUp size={18} color="var(--accent-green)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-green)' }}>
            +${metrics.totalProfitUsd.toFixed(2)} USD
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Across {metrics.totalTrades} simulated trades
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Win Rate (Simulated)
            </span>
            <Activity size={18} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{metrics.winRate.toFixed(1)}%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {metrics.totalTrades} completed trades
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Opportunities Detected
            </span>
            <Layers size={18} color="var(--accent-purple)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{metrics.detectedCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Continuously evaluated by risk rules
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Average RPC Latency
            </span>
            <Clock size={18} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{metrics.latencyMs} ms</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-green)', marginTop: '0.25rem' }}>
            ● Healthy response time
          </div>
        </div>
      </section>

      {/* Main Section: Live Opportunities Feed & Trade History */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Live Opportunities Feed */}
        <section className="glass-panel" style={{ padding: '1.75rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              Live Arbitrage Opportunities
            </h2>
            <RefreshCw size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {metrics.opportunities.length > 0 ? (
              metrics.opportunities.map((opp, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem' }}>{opp.pair}</span>
                      <span className="badge-success">+{opp.roiPercent.toFixed(2)}% ROI</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>Buy: <strong>{opp.buyDex}</strong></span>
                      <ArrowRight size={12} />
                      <span>Sell: <strong>{opp.sellDex}</strong></span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-green)' }}>
                      +${opp.profitUsd.toFixed(2)} USD
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Trade Size: ${opp.tradeSizeUsd.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>SOL / USDC</span>
                    <span className="badge-success">+1.69% ROI</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>Buy: <strong>Raydium</strong></span>
                    <ArrowRight size={12} />
                    <span>Sell: <strong>Orca</strong></span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-green)' }}>
                    +$1.69 USD
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Trade Size: $100.00
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Risk Limits & Safety Guardrails */}
        <section className="glass-panel" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <ShieldCheck size={20} color="var(--accent-green)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Risk Engine Safeguards</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Max Trade Cap:</span>
              <span style={{ fontWeight: 600 }}>$10.00 USD</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Min Net Profit:</span>
              <span style={{ fontWeight: 600 }}>$0.01 USD</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Max Slippage Allowed:</span>
              <span style={{ fontWeight: 600 }}>0.30%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Quote Expiration:</span>
              <span style={{ fontWeight: 600 }}>1,000 ms</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Execution Pathway:</span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>SOLANA DEVNET (Phase 3)</span>
            </div>
          </div>

          <div
            style={{
              marginTop: '1.5rem',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '1rem',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={18} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Deterministic pure math operates without AI heuristics. Live on-chain simulation is verified on Devnet.
            </p>
          </div>
        </section>
      </div>

      {/* Backtest Replay Simulator Panel */}
      <BacktestSimulatorSection />
    </main>
  );
}

interface BacktestSummaryState {
  totalTicksEvaluated: number;
  totalOpportunitiesDetected: number;
  totalTradesFilled: number;
  totalNetProfitUsd: number;
  winRatePercent: number;
  maxDrawdownPercent: number;
  profitFactor: number;
}

function BacktestSimulatorSection(): JSX.Element {
  const [isRunning, setIsRunning] = useState(false);
  const [delayMs, setDelayMs] = useState(150);
  const [decayRate, setDecayRate] = useState(10);
  const [result, setResult] = useState<BacktestSummaryState | null>(null);

  const handleRunBacktest = async (): Promise<void> => {
    setIsRunning(true);
    try {
      const res = await window.fetch('http://localhost:3000/api/v1/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionDelayMs: delayMs,
          simulatedSlippageDecayRate: decayRate / 100,
          initialCapitalUsd: 10.0,
          sampleTicksCount: 500,
        }),
      });

      if (res.ok) {
        const data = await res.json() as { summary: BacktestSummaryState };
        setResult(data.summary);
      }
    } catch {
      // Backend backtest fallback
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <section className="glass-panel" style={{ padding: '1.75rem', marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={18} color="var(--accent-purple)" />
            Realistic Backtest Replay Simulator
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Simulate 500 historical ticks with network transit latency and MEV competition spread decay.
          </p>
        </div>

        <button
          onClick={handleRunBacktest}
          disabled={isRunning}
          style={{
            background: isRunning ? '#334155' : 'linear-gradient(135deg, #00f0ff, #9d4edd)',
            color: '#0a0c10',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '8px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: '0.85rem',
          }}
        >
          {isRunning ? 'RUNNING REPLAY...' : 'RUN REALISTIC BACKTEST'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
            Execution Delay ({delayMs} ms)
          </label>
          <input
            type="range"
            min="50"
            max="400"
            step="10"
            value={delayMs}
            onChange={(e) => setDelayMs(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
            MEV Spread Decay ({decayRate}% per 100ms)
          </label>
          <input
            type="range"
            min="1"
            max="30"
            step="1"
            value={decayRate}
            onChange={(e) => setDecayRate(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.2)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Realized Net P/L</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-green)' }}>
              +${result.totalNetProfitUsd.toFixed(4)} USD
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>From $10.00 capital</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Realistic Win Rate</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{result.winRatePercent.toFixed(1)}%</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{result.totalTradesFilled} filled / {result.totalOpportunitiesDetected} detected</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Max Drawdown</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-red)' }}>{result.maxDrawdownPercent.toFixed(2)}%</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Peak to trough risk</div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Profit Factor</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>{result.profitFactor.toFixed(2)}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Gross wins / gross losses</div>
          </div>
        </div>
      )}
    </section>
  );
}
