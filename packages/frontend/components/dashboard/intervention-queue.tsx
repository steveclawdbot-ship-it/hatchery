'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { InterventionAction } from '@/lib/interventions/actions';

type InterventionStatus = 'open' | 'acknowledged' | 'resolved';
type InterventionSeverity = 'low' | 'medium' | 'high' | 'critical';

interface Intervention {
  id: string;
  status: InterventionStatus;
  reason: string;
  severity: InterventionSeverity;
  title: string;
  description: string;
  stepId: string | null;
  missionId: string | null;
  actionRunId: string | null;
  assignedTo: string | null;
  context: Record<string, unknown>;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  updatedAt: string;
}

export default function InterventionQueue() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assigneeById, setAssigneeById] = useState<Record<string, string>>({});

  useEffect(() => { void loadInterventions(); }, []);

  async function loadInterventions() {
    setLoading(true);
    try {
      const res = await fetch('/api/interventions');
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? 'Failed to load interventions');
      setInterventions(Array.isArray(payload?.interventions) ? payload.interventions as Intervention[] : []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load interventions');
    } finally {
      setLoading(false);
    }
  }

  async function runAction(id: string, action: InterventionAction, extra: { assignee?: string; note?: string } = {}) {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/interventions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? `Failed to ${action} intervention`);
      const updated = payload?.intervention;
      if (updated && typeof updated === 'object') {
        setInterventions((prev) => prev.map((i) => (i.id === id ? (updated as Intervention) : i)));
      } else {
        await loadInterventions();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} intervention`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ animation: 'slideUp 0.4s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{
          fontSize: 13,
          fontFamily: 'var(--hatch-font-display)',
          color: 'var(--hatch-text-primary)',
          margin: 0,
        }}>
          INTERVENTION QUEUE
        </h2>
        <button
          onClick={() => void loadInterventions()}
          disabled={loading}
          style={btnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--hatch-glow-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div style={{
        marginBottom: 12,
        fontSize: 11,
        fontFamily: 'var(--hatch-font-body)',
        color: 'var(--hatch-text-muted)',
      }}>
        Unresolved runtime blockers requiring operator action.
      </div>

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

      <div style={{
        border: '1px solid var(--hatch-border-default)',
        borderRadius: 8,
        background: 'var(--hatch-bg-surface)',
        overflow: 'hidden',
      }}>
        {interventions.length === 0 ? (
          <div style={{
            padding: 32,
            textAlign: 'center',
            fontFamily: 'var(--hatch-font-body)',
            color: 'var(--hatch-text-muted)',
            fontSize: 12,
          }}>
            No unresolved interventions.
          </div>
        ) : (
          <div className="stagger-mount">
            {interventions.map((item) => (
              <div key={item.id} style={{
                padding: 14,
                borderBottom: '1px solid var(--hatch-border-subtle)',
                display: 'grid',
                gap: 8,
                transition: 'background 150ms ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={severityBadge(item.severity)}>{item.severity.toUpperCase()}</span>
                  <span style={statusBadge(item.status)}>{item.status.toUpperCase()}</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--hatch-font-body)', color: 'var(--hatch-text-accent)' }}>
                    {item.reason}
                  </span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--hatch-font-body)', color: 'var(--hatch-text-muted)' }}>
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>

                <div style={{
                  fontSize: 13,
                  fontFamily: 'var(--hatch-font-body)',
                  color: 'var(--hatch-text-primary)',
                }}>
                  {item.title}
                </div>
                {item.description && (
                  <div style={{
                    fontSize: 12,
                    fontFamily: 'var(--hatch-font-body)',
                    color: 'var(--hatch-text-secondary)',
                    lineHeight: 1.5,
                  }}>
                    {item.description}
                  </div>
                )}

                <div style={{
                  fontSize: 10,
                  fontFamily: 'var(--hatch-font-body)',
                  color: 'var(--hatch-text-muted)',
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                }}>
                  <span>Run: {item.actionRunId ?? 'n/a'}</span>
                  <span>Step: {item.stepId ?? 'n/a'}</span>
                  <span>Mission: {item.missionId ?? 'n/a'}</span>
                  <span>Assigned: {item.assignedTo ?? 'unassigned'}</span>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <ActionBtn label="Acknowledge" disabled={busyId === item.id || item.status !== 'open'} onClick={() => void runAction(item.id, 'acknowledge')} />
                  <ActionBtn label="Retry Step" disabled={busyId === item.id || !item.stepId} onClick={() => void runAction(item.id, 'retry')} />
                  <ActionBtn label="Resolve" variant="success" disabled={busyId === item.id} onClick={() => void runAction(item.id, 'resolve')} />
                  <input
                    value={assigneeById[item.id] ?? ''}
                    onChange={(e) => setAssigneeById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="assignee"
                    style={inputStyle}
                  />
                  <ActionBtn
                    label="Reassign"
                    disabled={busyId === item.id || !(assigneeById[item.id] ?? '').trim()}
                    onClick={() => void runAction(item.id, 'reassign', { assignee: assigneeById[item.id] ?? '' })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ label, disabled, onClick, variant }: {
  label: string; disabled: boolean; onClick: () => void; variant?: 'success';
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btnStyle,
        ...(variant === 'success' ? { background: '#1d3b2a', border: '1px solid #2b5f44', color: '#7fe0a8' } : {}),
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.boxShadow = 'var(--hatch-glow-primary)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {label}
    </button>
  );
}

function severityBadge(severity: InterventionSeverity): CSSProperties {
  const color = severity === 'critical' ? '#ff6b6b' : severity === 'high' ? '#ff9f43' : severity === 'medium' ? '#ffd166' : '#8ecae6';
  return {
    fontSize: 9, fontFamily: 'var(--hatch-font-display)', color,
    border: `1px solid ${color}55`, background: `${color}1a`, borderRadius: 4, padding: '2px 6px',
    animation: (severity === 'critical' || severity === 'high') ? 'pulseGlow 1.5s ease-in-out infinite' : undefined,
    textShadow: (severity === 'critical') ? `0 0 6px ${color}` : undefined,
  };
}

function statusBadge(status: InterventionStatus): CSSProperties {
  const color = status === 'open' ? '#ff8f8f' : status === 'acknowledged' ? '#ffd166' : '#7fe0a8';
  return {
    fontSize: 9, fontFamily: 'var(--hatch-font-display)', color,
    border: `1px solid ${color}55`, background: `${color}1a`, borderRadius: 4, padding: '2px 6px',
  };
}

const btnStyle: CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--hatch-font-body)',
  padding: '6px 12px',
  background: 'var(--hatch-bg-elevated)',
  border: '1px solid var(--hatch-border-default)',
  borderRadius: 6,
  color: 'var(--hatch-text-accent)',
  cursor: 'pointer',
  transition: 'all 150ms ease',
};

const inputStyle: CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--hatch-font-body)',
  padding: '6px 8px',
  width: 110,
  background: 'var(--hatch-bg-surface)',
  border: '1px solid var(--hatch-border-default)',
  borderRadius: 6,
  color: 'var(--hatch-text-primary)',
  outline: 'none',
};
