'use client';

import { useEffect, useMemo, useState } from 'react';

interface OpsSummaryPayload {
  windowStart: string;
  windowEnd: string;
  heartbeatRuns: number;
  heartbeatFailures: number;
  latestHeartbeatRunId: string | null;
  stepsSucceeded: number;
  stepsFailed: number;
  stepFailureRate: number;
  avgStepLatencyMs: number;
  missionFailures24h: number;
  interventions: {
    unresolved: number;
    open: number;
    acknowledged: number;
  };
  alertThresholds: {
    missionFailures24h: number;
    stepFailureRate24h: number;
    heartbeatFailures24h: number;
  };
  thresholdBreaches: {
    missionFailures24h: boolean;
    stepFailureRate24h: boolean;
    heartbeatFailures24h: boolean;
  };
}

export default function OperationsSummary() {
  const [summary, setSummary] = useState<OpsSummaryPayload | null>(null);
  const [error, setError] = useState('');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchSummary = async () => {
      try {
        const res = await fetch('/api/ops/summary');
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(payload?.error ?? 'Failed to load operations summary');
        if (active) { setSummary(payload as OpsSummaryPayload); setError(''); }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load operations summary');
      }
    };
    void fetchSummary();
    const interval = setInterval(() => void fetchSummary(), 60_000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const cards = useMemo(() => {
    if (!summary) return [];
    return [
      { label: 'Heartbeat Runs', value: String(summary.heartbeatRuns), danger: false },
      { label: 'HB Failures', value: String(summary.heartbeatFailures), danger: summary.thresholdBreaches.heartbeatFailures24h },
      { label: 'Step Fail Rate', value: `${(summary.stepFailureRate * 100).toFixed(1)}%`, danger: summary.thresholdBreaches.stepFailureRate24h },
      { label: 'Avg Latency', value: `${Math.round(summary.avgStepLatencyMs)}ms`, danger: false },
      { label: 'Mission Fails', value: String(summary.missionFailures24h), danger: summary.thresholdBreaches.missionFailures24h },
      { label: 'Unresolved', value: String(summary.interventions.unresolved), danger: summary.interventions.unresolved > 0 },
    ];
  }, [summary]);

  return (
    <div style={{ animation: 'slideUp 0.4s ease-out' }}>
      <h3 style={{
        fontSize: 11,
        fontFamily: 'var(--hatch-font-display)',
        color: 'var(--hatch-text-primary)',
        margin: '0 0 14px 0',
      }}>
        OPS SUMMARY (24H)
      </h3>

      {error && (
        <div style={{
          border: '1px solid #5f2b2b',
          background: '#301010',
          color: '#ff8f8f',
          borderRadius: 6,
          padding: 10,
          fontSize: 11,
          fontFamily: 'var(--hatch-font-body)',
          marginBottom: 10,
        }}>
          {error}
        </div>
      )}

      {!summary ? (
        <div style={{
          fontSize: 11,
          fontFamily: 'var(--hatch-font-body)',
          color: 'var(--hatch-text-muted)',
        }}>
          Loading...
        </div>
      ) : (
        <div className="stagger-mount" style={{
          display: 'grid',
          gap: 8,
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        }}>
          {cards.map((card) => (
            <div
              key={card.label}
              onMouseEnter={() => setHoveredCard(card.label)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                border: `1px solid ${card.danger ? '#5f2b2b' : 'var(--hatch-border-default)'}`,
                background: card.danger ? '#2b1111' : 'var(--hatch-bg-surface)',
                borderRadius: 8,
                padding: '10px 12px',
                transition: 'all 200ms ease',
                transform: hoveredCard === card.label ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: card.danger
                  ? '0 0 12px rgba(244, 67, 54, 0.15)'
                  : hoveredCard === card.label
                    ? 'var(--hatch-glow-primary)'
                    : 'none',
                animation: card.danger ? 'dangerPulse 2s ease-in-out infinite' : undefined,
              }}
            >
              <div style={{
                fontSize: 9,
                fontFamily: 'var(--hatch-font-body)',
                color: 'var(--hatch-text-muted)',
                marginBottom: 6,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {card.label}
              </div>
              <div style={{
                fontSize: 16,
                fontFamily: 'var(--hatch-font-display)',
                color: card.danger ? '#ff8f8f' : 'var(--hatch-text-primary)',
                textShadow: card.danger ? '0 0 8px rgba(255, 143, 143, 0.4)' : undefined,
              }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
