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

  useEffect(() => {
    void loadInterventions();
  }, []);

  async function loadInterventions() {
    setLoading(true);
    try {
      const res = await fetch('/api/interventions');
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          payload?.error && typeof payload.error === 'string'
            ? payload.error
            : 'Failed to load interventions',
        );
      }

      const rows = Array.isArray(payload?.interventions)
        ? payload.interventions
        : [];
      setInterventions(rows as Intervention[]);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load interventions');
    } finally {
      setLoading(false);
    }
  }

  async function runAction(
    id: string,
    action: InterventionAction,
    extra: { assignee?: string; note?: string } = {},
  ) {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/interventions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...extra,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          payload?.error && typeof payload.error === 'string'
            ? payload.error
            : `Failed to ${action} intervention`,
        );
      }

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
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Intervention Queue</h2>
        <button
          onClick={() => void loadInterventions()}
          disabled={loading}
          style={secondaryButtonStyle}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div style={{ marginBottom: 10, fontSize: 11, color: '#8a8a9a' }}>
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
          marginBottom: 10,
        }}
        >
          {error}
        </div>
      )}

      <div style={{ border: '1px solid #2a2a5a', borderRadius: 6 }}>
        {interventions.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#8a8a9a', fontSize: 12 }}>
            No unresolved interventions.
          </div>
        ) : (
          interventions.map((item) => (
            <div
              key={item.id}
              style={{
                padding: 12,
                borderBottom: '1px solid #1a1a3a',
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={severityBadgeStyle(item.severity)}>
                  {item.severity.toUpperCase()}
                </span>
                <span style={statusBadgeStyle(item.status)}>{item.status.toUpperCase()}</span>
                <span style={{ fontSize: 11, color: '#9aa0ff' }}>{item.reason}</span>
                <span style={{ fontSize: 11, color: '#6f7398' }}>
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>

              <div style={{ fontSize: 13, color: '#e0e0e0' }}>{item.title}</div>
              {item.description && (
                <div style={{ fontSize: 12, color: '#b9bdd8' }}>{item.description}</div>
              )}

              <div style={{ fontSize: 11, color: '#8a8a9a', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>ID: {item.id}</span>
                <span>Run: {item.actionRunId ?? 'n/a'}</span>
                <span>Step: {item.stepId ?? 'n/a'}</span>
                <span>Mission: {item.missionId ?? 'n/a'}</span>
                <span>Assigned: {item.assignedTo ?? 'unassigned'}</span>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => void runAction(item.id, 'acknowledge')}
                  disabled={busyId === item.id || item.status !== 'open'}
                  style={actionButtonStyle}
                >
                  Acknowledge
                </button>
                <button
                  onClick={() => void runAction(item.id, 'retry')}
                  disabled={busyId === item.id || !item.stepId}
                  style={actionButtonStyle}
                >
                  Retry Step
                </button>
                <button
                  onClick={() => void runAction(item.id, 'resolve')}
                  disabled={busyId === item.id}
                  style={resolveButtonStyle}
                >
                  Resolve
                </button>
                <input
                  value={assigneeById[item.id] ?? ''}
                  onChange={(event) => setAssigneeById((prev) => ({
                    ...prev,
                    [item.id]: event.target.value,
                  }))}
                  placeholder="assignee"
                  style={assigneeInputStyle}
                />
                <button
                  onClick={() => void runAction(item.id, 'reassign', { assignee: assigneeById[item.id] ?? '' })}
                  disabled={busyId === item.id || !(assigneeById[item.id] ?? '').trim()}
                  style={secondaryButtonStyle}
                >
                  Reassign
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function severityBadgeStyle(severity: InterventionSeverity): CSSProperties {
  const color = severity === 'critical'
    ? '#ff6b6b'
    : severity === 'high'
      ? '#ff9f43'
      : severity === 'medium'
        ? '#ffd166'
        : '#8ecae6';

  return {
    fontSize: 10,
    color,
    border: `1px solid ${color}55`,
    background: `${color}1a`,
    borderRadius: 4,
    padding: '2px 6px',
  };
}

function statusBadgeStyle(status: InterventionStatus): CSSProperties {
  const color = status === 'open'
    ? '#ff8f8f'
    : status === 'acknowledged'
      ? '#ffd166'
      : '#7fe0a8';

  return {
    fontSize: 10,
    color,
    border: `1px solid ${color}55`,
    background: `${color}1a`,
    borderRadius: 4,
    padding: '2px 6px',
  };
}

const actionButtonStyle: CSSProperties = {
  fontSize: 11,
  padding: '6px 10px',
  background: '#1a1a3a',
  border: '1px solid #2a2a5a',
  borderRadius: 4,
  color: '#9aa0ff',
  cursor: 'pointer',
};

const resolveButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  background: '#1d3b2a',
  border: '1px solid #2b5f44',
  color: '#7fe0a8',
};

const secondaryButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  color: '#c3c8f0',
};

const assigneeInputStyle: CSSProperties = {
  fontSize: 11,
  padding: '6px 8px',
  width: 110,
  background: '#0f0f25',
  border: '1px solid #2a2a5a',
  borderRadius: 4,
  color: '#e0e0e0',
  fontFamily: 'inherit',
};
