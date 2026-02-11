'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { OfficeEvent } from '@/hooks/use-agents';

interface EventStreamPanelProps {
  events: OfficeEvent[];
  agents: Array<{ id: string; displayName: string; color: string }>;
  isLoading?: boolean;
}

type EventFilter = 'all' | 'action' | 'message' | 'system' | 'stats';

const MAX_EVENTS = 50;
const SCROLL_SPEED = 40; // pixels per second

export default function EventStreamPanel({
  events,
  agents,
  isLoading,
}: EventStreamPanelProps) {
  const [filter, setFilter] = useState<EventFilter>('all');
  const [isPaused, setIsPaused] = useState(false);
  const [displayedEvents, setDisplayedEvents] = useState<OfficeEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef(0);
  const animationRef = useRef<number>();

  // Filter events
  const filteredEvents = events.filter((event) => {
    if (filter === 'all') return true;
    if (filter === 'action') return event.kind?.includes('action');
    if (filter === 'message') return event.kind?.includes('message') || event.kind?.includes('chat');
    if (filter === 'system') return event.kind?.includes('system');
    if (filter === 'stats') return event.kind?.includes('stat');
    return true;
  });

  // Update displayed events when filtered events change
  useEffect(() => {
    setDisplayedEvents((prev) => {
      const newEvents = filteredEvents.filter(
        (e) => !prev.some((p) => p.id === e.id)
      );
      const updated = [...newEvents, ...prev].slice(0, MAX_EVENTS);
      return updated;
    });
  }, [filteredEvents]);

  // Auto-scroll animation
  useEffect(() => {
    if (isPaused) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    let lastTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      scrollPosRef.current += SCROLL_SPEED * delta;

      if (scrollRef.current) {
        const maxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
        if (scrollPosRef.current > maxScroll) {
          scrollPosRef.current = 0;
        }
        scrollRef.current.scrollTop = scrollPosRef.current;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPaused]);

  const getAgentInfo = (agentId: string) => {
    return agents.find((a) => a.id === agentId) || {
      displayName: agentId,
      color: '#9e9e9e',
    };
  };

  const getEventIcon = (kind: string): string => {
    if (kind?.includes('message')) return '💬';
    if (kind?.includes('action')) return '⚡';
    if (kind?.includes('system')) return '🔧';
    if (kind?.includes('thought')) return '💭';
    if (kind?.includes('stat')) return '📊';
    if (kind?.includes('error')) return '❌';
    if (kind?.includes('success')) return '✅';
    return '📌';
  };

  const getEventColor = (kind: string): string => {
    if (kind?.includes('error')) return '#f44336';
    if (kind?.includes('success')) return '#4caf50';
    if (kind?.includes('system')) return '#9c27b0';
    if (kind?.includes('message')) return '#2196f3';
    return '#7c5cff';
  };

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const filters: { key: EventFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: events.length },
    { key: 'action', label: 'Actions', count: events.filter((e) => e.kind?.includes('action')).length },
    { key: 'message', label: 'Messages', count: events.filter((e) => e.kind?.includes('message')).length },
    { key: 'system', label: 'System', count: events.filter((e) => e.kind?.includes('system')).length },
    { key: 'stats', label: 'Stats', count: events.filter((e) => e.kind?.includes('stat')).length },
  ];

  return (
    <div
      style={{
        height: 120,
        backgroundColor: '#1a1a3a',
        borderTop: '2px solid #2a2a5a',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Header with filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          borderBottom: '1px solid #2a2a5a',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 8,
              color: '#7c5cff',
            }}
          >
            📊 Event Stream
          </span>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: '2px 8px',
                  fontSize: 9,
                  border: 'none',
                  borderRadius: 3,
                  cursor: 'pointer',
                  backgroundColor: filter === f.key ? '#7c5cff' : '#252545',
                  color: filter === f.key ? '#fff' : '#999',
                  fontFamily: 'system-ui, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {f.label}
                <span
                  style={{
                    fontSize: 8,
                    backgroundColor: filter === f.key ? '#fff3' : '#333',
                    padding: '0 4px',
                    borderRadius: 2,
                  }}
                >
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Status indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 9,
            color: isPaused ? '#ff9800' : '#4caf50',
          }}
        >
          {isPaused ? '⏸ Paused' : '▶ Live'}
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: isPaused ? '#ff9800' : '#4caf50',
              animation: isPaused ? 'none' : 'pulse 2s infinite',
            }}
          />
        </div>
      </div>

      {/* Event list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {isLoading && displayedEvents.length === 0 ? (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              color: '#666',
              fontSize: 10,
            }}
          >
            Loading events...
          </div>
        ) : displayedEvents.length === 0 ? (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              color: '#666',
              fontSize: 10,
            }}
          >
            No events yet...
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {displayedEvents.map((event, index) => {
              const agent = getAgentInfo(event.agentId);
              const icon = getEventIcon(event.kind);
              const color = getEventColor(event.kind);

              return (
                <div
                  key={event.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 12px',
                    backgroundColor: index % 2 === 0 ? '#1a1a3a' : '#252545',
                    fontSize: 10,
                    fontFamily: 'system-ui, sans-serif',
                    borderLeft: `3px solid ${color}`,
                  }}
                >
                  {/* Time */}
                  <span style={{ color: '#666', minWidth: 60, fontSize: 9 }}>
                    {formatTime(event.timestamp)}
                  </span>

                  {/* Icon */}
                  <span style={{ minWidth: 16 }}>{icon}</span>

                  {/* Agent */}
                  <span
                    style={{
                      color: agent.color,
                      fontWeight: 'bold',
                      minWidth: 60,
                    }}
                  >
                    {agent.displayName}
                  </span>

                  {/* Event content */}
                  <span style={{ color: '#ccc', flex: 1 }}>
                    {event.data?.message || event.data?.content || event.kind}
                  </span>

                  {/* Event type badge */}
                  <span
                    style={{
                      fontSize: 8,
                      padding: '2px 6px',
                      backgroundColor: color + '33',
                      color: color,
                      borderRadius: 2,
                      textTransform: 'uppercase',
                    }}
                  >
                    {event.kind?.split('.')[1] || event.kind}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
