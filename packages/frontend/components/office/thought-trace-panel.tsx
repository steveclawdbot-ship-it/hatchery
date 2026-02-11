'use client';

import { useState, useEffect, useRef } from 'react';
import { ThoughtTrace } from '@/hooks/use-agents';

interface ThoughtTracePanelProps {
  thoughts: ThoughtTrace[];
  agents: Array<{ id: string; displayName: string; color: string }>;
  selectedAgentId: string | null;
  onAgentClick: (agentId: string) => void;
  isLoading?: boolean;
}

const MAX_ITEMS = 20;
const TYPING_DELAY = 30; // ms per character

export default function ThoughtTracePanel({
  thoughts,
  agents,
  selectedAgentId,
  onAgentClick,
  isLoading,
}: ThoughtTracePanelProps) {
  const [displayedThoughts, setDisplayedThoughts] = useState<Array<{
    id: string;
    agentId: string;
    content: string;
    displayContent: string;
    timestamp: string;
    isTyping: boolean;
  }>>([]);

  // Typing effect for new thoughts
  useEffect(() => {
    const latestThought = thoughts[0];
    if (!latestThought) return;

    // Check if this thought is already being displayed
    const existingIndex = displayedThoughts.findIndex(t => t.id === latestThought.id);
    if (existingIndex >= 0) return;

    // Add new thought with typing animation
    const newThought = {
      id: latestThought.id,
      agentId: latestThought.agentId,
      content: latestThought.content,
      displayContent: '',
      timestamp: latestThought.timestamp,
      isTyping: true,
    };

    setDisplayedThoughts(prev => {
      const updated = [newThought, ...prev].slice(0, MAX_ITEMS);
      return updated;
    });

    // Animate typing
    let charIndex = 0;
    const content = latestThought.content;
    
    const typeInterval = setInterval(() => {
      charIndex++;
      setDisplayedThoughts(prev => 
        prev.map(t => 
          t.id === latestThought.id
            ? { ...t, displayContent: content.slice(0, charIndex) }
            : t
        )
      );

      if (charIndex >= content.length) {
        clearInterval(typeInterval);
        setDisplayedThoughts(prev =>
          prev.map(t =>
            t.id === latestThought.id
              ? { ...t, isTyping: false, displayContent: content }
              : t
          )
        );
      }
    }, TYPING_DELAY);

    return () => clearInterval(typeInterval);
  }, [thoughts]);

  // Sync with existing thoughts (for initial load / pagination)
  useEffect(() => {
    const existingIds = new Set(displayedThoughts.map(t => t.id));
    const newThoughts = thoughts
      .filter(t => !existingIds.has(t.id))
      .map(t => ({
        id: t.id,
        agentId: t.agentId,
        content: t.content,
        displayContent: t.content, // Show full content for older thoughts
        timestamp: t.timestamp,
        isTyping: false,
      }));

    if (newThoughts.length > 0) {
      setDisplayedThoughts(prev => 
        [...newThoughts, ...prev].slice(0, MAX_ITEMS)
      );
    }
  }, [thoughts]);

  const getAgentInfo = (agentId: string) => {
    return agents.find(a => a.id === agentId) || {
      displayName: agentId,
      color: '#9e9e9e',
    };
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      style={{
        width: 280,
        height: '100%',
        backgroundColor: '#1a1a3a',
        border: '2px solid #2a2a5a',
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '2px solid #2a2a5a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 8,
            color: '#7c5cff',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          💭 LIVE
        </div>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: '#4caf50',
            animation: 'pulse 2s infinite',
          }}
        />
      </div>

      {/* Thoughts List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {isLoading && displayedThoughts.length === 0 ? (
          <div style={{ color: '#666', fontSize: 10, textAlign: 'center', padding: 20 }}>
            Loading thoughts...
          </div>
        ) : displayedThoughts.length === 0 ? (
          <div style={{ color: '#666', fontSize: 10, textAlign: 'center', padding: 40 }}>
            No thoughts yet...
          </div>
        ) : (
          displayedThoughts.map((thought) => {
            const agent = getAgentInfo(thought.agentId);
            const isSelected = selectedAgentId === thought.agentId;

            return (
              <div
                key={thought.id}
                onClick={() => onAgentClick(thought.agentId)}
                style={{
                  backgroundColor: isSelected ? '#2a2a5a' : '#252545',
                  borderRadius: 8,
                  padding: 10,
                  cursor: 'pointer',
                  border: `2px solid ${isSelected ? agent.color : 'transparent'}`,
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Agent Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor: agent.color,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 'bold',
                      color: agent.color,
                      fontFamily: 'system-ui, sans-serif',
                    }}
                  >
                    {agent.displayName}
                  </span>
                  <span style={{ fontSize: 8, color: '#666', marginLeft: 'auto' }}>
                    {formatTime(thought.timestamp)}
                  </span>
                </div>

                {/* Thought Content */}
                <div
                  style={{
                    fontSize: 11,
                    color: '#ccc',
                    lineHeight: 1.5,
                    fontFamily: 'system-ui, sans-serif',
                    minHeight: 18,
                  }}
                >
                  {thought.displayContent}
                  {thought.isTyping && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 2,
                        height: 12,
                        backgroundColor: '#7c5cff',
                        marginLeft: 2,
                        animation: 'blink 1s infinite',
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Stats */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '2px solid #2a2a5a',
          fontSize: 8,
          color: '#666',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{displayedThoughts.length} / {MAX_ITEMS}</span>
        <span>Click to filter</span>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
