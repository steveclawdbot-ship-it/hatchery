'use client';

import { useState, useEffect } from 'react';

interface Step {
  id: string;
  kind: string;
  status: string;
  step_number: number;
}

interface Mission {
  id: string;
  title: string;
  status: string;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  completed_steps: number;
  total_steps: number;
  steps?: Step[];
}

export default function MissionList() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMissions = async () => {
      try {
        const res = await fetch('/api/missions');
        if (res.ok) { setMissions(await res.json()); }
      } catch {
        setMissions([
          { id: '1', title: 'Draft weekly newsletter', status: 'running', created_by: 'coordinator', created_at: new Date().toISOString(), completed_at: null, completed_steps: 1, total_steps: 3 },
          { id: '2', title: 'Analyze competitor tweets', status: 'succeeded', created_by: 'analyst', created_at: new Date(Date.now() - 3600000).toISOString(), completed_at: new Date().toISOString(), completed_steps: 2, total_steps: 2 },
        ]);
      }
    };
    fetchMissions();
    const interval = setInterval(fetchMissions, 15000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === 'all' ? missions : missions.filter((m) => m.status === filter);

  const statusColor = (status: string) => {
    switch (status) {
      case 'running': return 'var(--hatch-warning)';
      case 'succeeded': return 'var(--hatch-success)';
      case 'failed': return 'var(--hatch-danger)';
      default: return 'var(--hatch-text-muted)';
    }
  };

  return (
    <div style={{ animation: 'slideUp 0.4s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{
          fontSize: 13,
          fontFamily: 'var(--hatch-font-display)',
          color: 'var(--hatch-text-primary)',
          margin: 0,
        }}>
          MISSIONS
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'running', 'succeeded', 'failed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: 9,
                fontFamily: 'var(--hatch-font-display)',
                padding: '4px 8px',
                background: filter === f ? 'var(--hatch-bg-elevated)' : 'transparent',
                color: filter === f ? 'var(--hatch-accent-primary)' : 'var(--hatch-text-muted)',
                border: '1px solid var(--hatch-border-default)',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        border: '1px solid var(--hatch-border-default)',
        borderRadius: 8,
        background: 'var(--hatch-bg-surface)',
        overflow: 'hidden',
      }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: 32,
            textAlign: 'center',
            fontSize: 11,
            fontFamily: 'var(--hatch-font-body)',
            color: 'var(--hatch-text-muted)',
          }}>
            No missions found.
          </div>
        ) : (
          <div className="stagger-mount">
            {filtered.map((mission) => {
              const isHovered = hoveredId === mission.id;
              const progress = mission.total_steps > 0
                ? (mission.completed_steps / mission.total_steps) * 100
                : 0;
              return (
                <div key={mission.id} style={{ borderBottom: '1px solid var(--hatch-border-subtle)' }}>
                  <div
                    onClick={() => {
                      const next = new Set(expanded);
                      if (next.has(mission.id)) next.delete(mission.id);
                      else next.add(mission.id);
                      setExpanded(next);
                    }}
                    onMouseEnter={() => setHoveredId(mission.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: isHovered ? 'var(--hatch-bg-elevated)' : 'transparent',
                      transition: 'background 150ms ease',
                    }}
                  >
                    <span style={{
                      width: 8,
                      height: 8,
                      backgroundColor: statusColor(mission.status),
                      borderRadius: '50%',
                      display: 'inline-block',
                      boxShadow: `0 0 6px ${mission.status === 'running' ? 'rgba(255,152,0,0.5)' : mission.status === 'failed' ? 'rgba(244,67,54,0.5)' : 'rgba(76,175,80,0.3)'}`,
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 12,
                      fontFamily: 'var(--hatch-font-body)',
                      flex: 1,
                      color: 'var(--hatch-text-primary)',
                    }}>
                      {mission.title}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontFamily: 'var(--hatch-font-body)',
                      color: 'var(--hatch-accent-primary)',
                    }}>
                      {mission.created_by}
                    </span>
                    {/* Progress bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 40,
                        height: 4,
                        backgroundColor: 'var(--hatch-bg-deep)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${progress}%`,
                          height: '100%',
                          backgroundColor: statusColor(mission.status),
                          borderRadius: 2,
                          transition: 'width 300ms ease',
                        }} />
                      </div>
                      <span style={{
                        fontSize: 10,
                        fontFamily: 'var(--hatch-font-body)',
                        color: 'var(--hatch-text-muted)',
                        whiteSpace: 'nowrap',
                      }}>
                        {mission.completed_steps}/{mission.total_steps}
                      </span>
                    </div>
                  </div>

                  {expanded.has(mission.id) && mission.steps && (
                    <div className="stagger-mount" style={{ padding: '0 14px 12px 34px' }}>
                      {mission.steps.map((step) => (
                        <div key={step.id} style={{
                          fontSize: 11,
                          fontFamily: 'var(--hatch-font-body)',
                          padding: '4px 0',
                          color: step.status === 'succeeded' ? 'var(--hatch-success)'
                            : step.status === 'failed' ? 'var(--hatch-danger)'
                              : step.status === 'running' ? 'var(--hatch-warning)' : 'var(--hatch-text-muted)',
                        }}>
                          {step.step_number}. {step.kind} [{step.status}]
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
