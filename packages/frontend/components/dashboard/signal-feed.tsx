'use client';

import { useState, useEffect } from 'react';

interface Event {
  id: string;
  agentId: string;
  kind: string;
  title: string;
  summary: string;
  createdAt: string;
}

export default function SignalFeed({ compact = false }: { compact?: boolean }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState<'live' | 'delayed'>('live');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const POLL_MS = 5 * 60 * 1000;
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch('/api/events/history');
        if (res.ok) {
          const data = await res.json();
          if (!active) return;
          setEvents(Array.isArray(data) ? data : []);
          setStatus('live');
          setLastUpdated(new Date().toISOString());
          return;
        }
      } catch {
        // ignored
      }
      if (active) setStatus('delayed');
    };

    void poll();
    const interval = setInterval(() => { void poll(); }, POLL_MS);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const getKindColor = (kind: string): string => {
    if (kind.startsWith('system.')) return 'var(--hatch-text-muted)';
    if (kind.startsWith('conversation.')) return 'var(--hatch-info)';
    if (kind.startsWith('step.succeeded')) return 'var(--hatch-success)';
    if (kind.startsWith('step.failed')) return 'var(--hatch-danger)';
    if (kind.startsWith('mission.')) return 'var(--hatch-warning)';
    if (kind.includes('alert')) return 'var(--hatch-danger)';
    return 'var(--hatch-accent-primary)';
  };

  const displayEvents = compact ? events.slice(0, 10) : events;

  return (
    <div style={{ animation: 'slideUp 0.4s ease-out' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: compact ? 10 : 16,
      }}>
        <h2 style={{
          fontSize: compact ? 11 : 13,
          margin: 0,
          fontFamily: 'var(--hatch-font-display)',
          color: 'var(--hatch-text-primary)',
        }}>
          {compact ? 'RECENT SIGNALS' : 'SIGNAL FEED'}
        </h2>
        <span style={{
          fontSize: 10,
          fontFamily: 'var(--hatch-font-display)',
          padding: '3px 8px',
          backgroundColor: status === 'live' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
          color: status === 'live' ? 'var(--hatch-success)' : 'var(--hatch-danger)',
          borderRadius: 4,
          animation: status === 'live' ? 'liveIndicator 2s ease-in-out infinite' : undefined,
        }}>
          {status === 'live' ? 'LIVE' : 'DELAYED'}
        </span>
      </div>

      {!compact && (
        <div style={{
          fontSize: 11,
          fontFamily: 'var(--hatch-font-body)',
          color: 'var(--hatch-text-muted)',
          marginBottom: 10,
        }}>
          {lastUpdated
            ? `Last sync: ${new Date(lastUpdated).toLocaleTimeString()}`
            : 'Waiting for first sync...'}
        </div>
      )}

      <div style={{
        maxHeight: compact ? 300 : 600,
        overflowY: 'auto',
        border: '1px solid var(--hatch-border-default)',
        borderRadius: 6,
        background: 'var(--hatch-bg-surface)',
      }}>
        {displayEvents.length === 0 ? (
          <div style={{
            padding: 32,
            textAlign: 'center',
            fontSize: 11,
            fontFamily: 'var(--hatch-font-body)',
            color: 'var(--hatch-text-muted)',
          }}>
            No events yet. Start the heartbeat to see activity.
          </div>
        ) : (
          displayEvents.map((event) => (
            <div
              key={event.id}
              onMouseEnter={() => setHoveredId(event.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--hatch-border-subtle)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                background: hoveredId === event.id ? 'var(--hatch-bg-elevated)' : 'transparent',
                transition: 'background 150ms ease',
              }}
            >
              <span style={{
                fontSize: 10,
                fontFamily: 'var(--hatch-font-body)',
                color: 'var(--hatch-text-muted)',
                whiteSpace: 'nowrap',
                marginTop: 2,
              }}>
                {new Date(event.createdAt).toLocaleTimeString()}
              </span>
              <span style={{
                fontSize: 9,
                fontFamily: 'var(--hatch-font-display)',
                padding: '2px 6px',
                backgroundColor: 'rgba(124, 92, 255, 0.1)',
                color: getKindColor(event.kind),
                borderRadius: 3,
                whiteSpace: 'nowrap',
                textShadow: `0 0 6px currentColor`,
              }}>
                {event.kind}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 12,
                  fontFamily: 'var(--hatch-font-body)',
                  marginBottom: 2,
                  color: 'var(--hatch-text-primary)',
                }}>
                  <span style={{ color: 'var(--hatch-accent-primary)' }}>{event.agentId}</span>
                  {' '}
                  {event.title}
                </div>
                {event.summary && !compact && (
                  <div style={{
                    fontSize: 11,
                    fontFamily: 'var(--hatch-font-body)',
                    color: 'var(--hatch-text-secondary)',
                  }}>
                    {event.summary.slice(0, 200)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
