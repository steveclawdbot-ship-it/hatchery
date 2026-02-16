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

  useEffect(() => {
    let active = true;

    const fetchSummary = async () => {
      try {
        const res = await fetch('/api/ops/summary');
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            payload?.error && typeof payload.error === 'string'
              ? payload.error
              : 'Failed to load operations summary',
          );
        }
        if (active) {
          setSummary(payload as OpsSummaryPayload);
          setError('');
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load operations summary');
        }
      }
    };

    void fetchSummary();
    const interval = setInterval(() => void fetchSummary(), 60_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const cards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: 'Heartbeat Runs (24h)',
        value: String(summary.heartbeatRuns),
        danger: false,
      },
      {
        label: 'Heartbeat Failures (24h)',
        value: String(summary.heartbeatFailures),
        danger: summary.thresholdBreaches.heartbeatFailures24h,
      },
      {
        label: 'Step Failure Rate (24h)',
        value: `${(summary.stepFailureRate * 100).toFixed(1)}%`,
        danger: summary.thresholdBreaches.stepFailureRate24h,
      },
      {
        label: 'Avg Step Latency',
        value: `${Math.round(summary.avgStepLatencyMs)} ms`,
        danger: false,
      },
      {
        label: 'Mission Failures (24h)',
        value: String(summary.missionFailures24h),
        danger: summary.thresholdBreaches.missionFailures24h,
      },
      {
        label: 'Unresolved Interventions',
        value: String(summary.interventions.unresolved),
        danger: summary.interventions.unresolved > 0,
      },
    ];
  }, [summary]);

  return (
    <section style={{ border: '1px solid #2a2a5a', borderRadius: 6, padding: 16 }}>
      <h3 style={{ fontSize: 16, margin: '0 0 12px 0' }}>Operations Summary</h3>

      {error && (
        <div style={{
          border: '1px solid #5f2b2b',
          background: '#301010',
          color: '#ff8f8f',
          borderRadius: 6,
          padding: 10,
          fontSize: 11,
          marginBottom: 10,
        }}
        >
          {error}
        </div>
      )}

      {!summary ? (
        <div style={{ fontSize: 11, color: '#8a8a9a' }}>Loading operations summary...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            {cards.map((card) => (
              <div
                key={card.label}
                style={{
                  border: `1px solid ${card.danger ? '#5f2b2b' : '#2a2a5a'}`,
                  background: card.danger ? '#2b1111' : '#101030',
                  borderRadius: 6,
                  padding: 10,
                }}
              >
                <div style={{ fontSize: 10, color: '#8a8a9a', marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontSize: 15, color: card.danger ? '#ff8f8f' : '#d9ddff' }}>{card.value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: '#8a8a9a', display: 'grid', gap: 4 }}>
            <div>
              Alert thresholds:
              {' '}
              mission failures &gt;=
              {' '}
              {summary.alertThresholds.missionFailures24h},
              {' '}
              step failure rate &gt;=
              {' '}
              {(summary.alertThresholds.stepFailureRate24h * 100).toFixed(0)}
              %,
              {' '}
              heartbeat failures &gt;=
              {' '}
              {summary.alertThresholds.heartbeatFailures24h}.
            </div>
            <div>
              Latest heartbeat run:
              {' '}
              {summary.latestHeartbeatRunId ?? 'n/a'}
            </div>
            <div>
              Window:
              {' '}
              {new Date(summary.windowStart).toLocaleString()}
              {' '}
              -
              {' '}
              {new Date(summary.windowEnd).toLocaleString()}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
