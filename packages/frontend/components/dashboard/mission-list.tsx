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

  useEffect(() => {
    const fetchMissions = async () => {
      try {
        const res = await fetch('/api/missions');
        if (res.ok) {
          setMissions(await res.json());
        }
      } catch {
        // Demo data
        setMissions([
          {
            id: '1', title: 'Draft weekly newsletter', status: 'running',
            created_by: 'coordinator', created_at: new Date().toISOString(),
            completed_at: null, completed_steps: 1, total_steps: 3,
          },
          {
            id: '2', title: 'Analyze competitor tweets', status: 'succeeded',
            created_by: 'analyst', created_at: new Date(Date.now() - 3600000).toISOString(),
            completed_at: new Date().toISOString(), completed_steps: 2, total_steps: 2,
          },
        ]);
      }
    };
    fetchMissions();
    const interval = setInterval(fetchMissions, 15000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === 'all'
    ? missions
    : missions.filter((m) => m.status === filter);

  const statusColor = (status: string) => {
    switch (status) {
      case 'running': return '#FF9800';
      case 'succeeded': return '#4CAF50';
      case 'failed': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Missions</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'running', 'succeeded', 'failed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: 10,
                padding: '4px 8px',
                background: filter === f ? '#2a2a5a' : 'transparent',
                color: filter === f ? '#7c5cff' : '#666',
                border: '1px solid #2a2a5a',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ border: '1px solid #2a2a5a', borderRadius: 4 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#666' }}>
            No missions found.
          </div>
        ) : (
          filtered.map((mission) => (
            <div key={mission.id} style={{ borderBottom: '1px solid #1a1a3a' }}>
              <div
                onClick={() => {
                  const next = new Set(expanded);
                  if (next.has(mission.id)) {
                    next.delete(mission.id);
                  } else {
                    next.add(mission.id);
                  }
                  setExpanded(next);
                }}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{
                  width: 8, height: 8,
                  backgroundColor: statusColor(mission.status),
                  borderRadius: '50%',
                  display: 'inline-block',
                }} />
                <span style={{ fontSize: 12, flex: 1 }}>{mission.title}</span>
                <span style={{ fontSize: 10, color: '#7c5cff' }}>{mission.created_by}</span>
                <span style={{ fontSize: 10, color: '#666' }}>
                  {mission.completed_steps}/{mission.total_steps}
                </span>
              </div>

              {expanded.has(mission.id) && mission.steps && (
                <div style={{ padding: '0 12px 10px 32px' }}>
                  {mission.steps.map((step) => (
                    <div key={step.id} style={{
                      fontSize: 11,
                      padding: '4px 0',
                      color: step.status === 'succeeded' ? '#4CAF50'
                        : step.status === 'failed' ? '#F44336'
                        : step.status === 'running' ? '#FF9800' : '#666',
                    }}>
                      {step.step_number}. {step.kind} [{step.status}]
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
