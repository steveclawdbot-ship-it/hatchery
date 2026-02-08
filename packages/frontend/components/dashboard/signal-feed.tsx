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

export default function SignalFeed() {
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState<'live' | 'delayed'>('live');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

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
    const interval = setInterval(() => {
      void poll();
    }, POLL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const getKindColor = (kind: string): string => {
    if (kind.startsWith('system.')) return '#9E9E9E';
    if (kind.startsWith('conversation.')) return '#2196F3';
    if (kind.startsWith('step.succeeded')) return '#4CAF50';
    if (kind.startsWith('step.failed')) return '#F44336';
    if (kind.startsWith('mission.')) return '#FF9800';
    if (kind.includes('alert')) return '#F44336';
    return '#7c5cff';
  };

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <h2 style={{ fontSize: 10, margin: 0 }}>Mission Feed</h2>
        <span style={{
          fontSize: 6,
          padding: '4px 8px',
          backgroundColor: status === 'live' ? '#4CAF5033' : '#F4433633',
          color: status === 'live' ? '#4CAF50' : '#F44336',
          borderRadius: 4,
        }}>
          {status === 'live' ? 'LIVE (POLL)' : 'DELAYED'}
        </span>
      </div>

      <div style={{ fontSize: 6, color: '#7a7a92', marginBottom: 8 }}>
        Updates every 5 minutes.
        {' '}
        {lastUpdated ? `Last sync: ${new Date(lastUpdated).toLocaleTimeString()}` : 'Waiting for first sync...'}
      </div>

      <div
        style={{
          maxHeight: 600,
          overflowY: 'auto',
          border: '1px solid #2a2a5a',
          borderRadius: 4,
        }}
      >
        {events.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 8, color: '#666' }}>
            No events yet. Start the heartbeat to see activity.
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #1a1a3a',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <span style={{
                fontSize: 6,
                color: '#666',
                whiteSpace: 'nowrap',
                marginTop: 2,
              }}>
                {new Date(event.createdAt).toLocaleTimeString()}
              </span>
              <span style={{
                fontSize: 6,
                padding: '2px 6px',
                backgroundColor: getKindColor(event.kind) + '22',
                color: getKindColor(event.kind),
                borderRadius: 2,
                whiteSpace: 'nowrap',
              }}>
                {event.kind}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8, marginBottom: 2 }}>
                  <span style={{ color: '#7c5cff' }}>{event.agentId}</span>
                  {' '}
                  {event.title}
                </div>
                {event.summary && (
                  <div style={{ fontSize: 7, color: '#888' }}>
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
