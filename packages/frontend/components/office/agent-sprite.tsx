'use client';

import { useState, useEffect } from 'react';

interface Agent {
  id: string;
  displayName: string;
  state: 'working' | 'chatting' | 'coffee' | 'celebrating' | 'idle';
  x: number;
  y: number;
}

const STATE_COLORS: Record<Agent['state'], string> = {
  working: '#4CAF50',
  chatting: '#2196F3',
  coffee: '#FF9800',
  celebrating: '#E91E63',
  idle: '#9E9E9E',
};

const STATE_EMOJI: Record<Agent['state'], string> = {
  working: '⌨',
  chatting: '💬',
  coffee: '☕',
  celebrating: '🎉',
  idle: '💤',
};

export default function AgentSprite({ agent }: { agent: Agent }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const color = STATE_COLORS[agent.state];
  const bobY = agent.state === 'celebrating' ? Math.sin(frame * Math.PI / 2) * 3 : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: agent.x,
        top: agent.y + bobY,
        textAlign: 'center',
        pointerEvents: 'auto',
        cursor: 'pointer',
      }}
      title={`${agent.displayName} (${agent.state})`}
    >
      {/* Head */}
      <div style={{
        width: 16, height: 16,
        backgroundColor: color,
        borderRadius: 2,
        margin: '0 auto',
        imageRendering: 'pixelated',
        boxShadow: `0 0 4px ${color}44`,
      }} />
      {/* Body */}
      <div style={{
        width: 12, height: 14,
        backgroundColor: color,
        margin: '2px auto 0',
        borderRadius: '0 0 2px 2px',
        opacity: 0.8,
      }} />
      {/* Name */}
      <div style={{
        fontSize: 6,
        fontFamily: '"Press Start 2P", monospace',
        color: '#ccc',
        marginTop: 4,
        whiteSpace: 'nowrap',
      }}>
        {agent.displayName}
      </div>
      {/* State indicator */}
      <div style={{ fontSize: 10, marginTop: 2 }}>
        {STATE_EMOJI[agent.state]}
      </div>
    </div>
  );
}
