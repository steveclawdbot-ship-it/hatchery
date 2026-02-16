'use client';

import { useState, useEffect, useMemo } from 'react';

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

const OUTFIT_COLORS = ['#5C6BC0', '#26A69A', '#EF5350', '#AB47BC', '#FFA726', '#66BB6A'];
const HAIR_COLORS = ['#2a2a4a', '#4a2a1a', '#1a3a5a', '#5a2a3a', '#3a3a2a', '#1a1a3a'];

function hashIndex(str: string, len: number): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % len;
}

const ANIMATION_MAP: Record<Agent['state'], string> = {
  idle: 'spriteIdle 2.5s ease-in-out infinite',
  working: 'spriteWork 0.6s ease-in-out infinite',
  chatting: 'spriteIdle 1.8s ease-in-out infinite',
  coffee: 'spriteIdle 3s ease-in-out infinite',
  celebrating: 'spriteBounce 0.5s ease-in-out infinite',
};

export default function AgentSprite({ agent, index }: { agent: Agent; index: number }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [confetti, setConfetti] = useState<Array<{ id: number; color: string; x: number }>>([]);

  const outfitColor = OUTFIT_COLORS[hashIndex(agent.id, OUTFIT_COLORS.length)];
  const hairColor = HAIR_COLORS[hashIndex(agent.id, HAIR_COLORS.length)];
  const stateColor = STATE_COLORS[agent.state];
  const hairVariant = index % 3; // 0=flat, 1=spiky, 2=parted

  // Celebrating confetti
  useEffect(() => {
    if (agent.state !== 'celebrating') { setConfetti([]); return; }
    const interval = setInterval(() => {
      setConfetti((prev) => {
        const next = prev.filter((c) => Date.now() - c.id < 1000);
        if (next.length < 4) {
          next.push({
            id: Date.now(),
            color: ['#ff5ce1', '#5ce1ff', '#ffb35c', '#7c5cff'][Math.floor(Math.random() * 4)],
            x: Math.random() * 20 - 10,
          });
        }
        return next;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [agent.state]);

  const skinColor = useMemo(() => {
    const skins = ['#FFD5B8', '#E8B88A', '#C68642', '#8D5524', '#FFDBB4', '#D4956A'];
    return skins[hashIndex(agent.id + 'skin', skins.length)];
  }, [agent.id]);

  return (
    <div
      style={{
        position: 'absolute',
        left: agent.x,
        top: agent.y,
        textAlign: 'center',
        pointerEvents: 'auto',
        cursor: 'pointer',
        zIndex: 5,
        animation: ANIMATION_MAP[agent.state],
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Confetti */}
      {confetti.map((c) => (
        <div key={c.id} style={{
          position: 'absolute',
          left: 6 + c.x,
          top: -10,
          width: 3,
          height: 3,
          backgroundColor: c.color,
          borderRadius: 1,
          animation: 'confetti 1s ease-out forwards',
          pointerEvents: 'none',
        }} />
      ))}

      {/* Chat bubble */}
      {agent.state === 'chatting' && (
        <div style={{
          position: 'absolute',
          top: -20,
          left: 8,
          background: 'rgba(255,255,255,0.9)',
          borderRadius: 3,
          padding: '1px 3px',
          fontSize: 6,
          color: '#333',
          animation: 'chatPulse 1.2s ease-in-out infinite',
          whiteSpace: 'nowrap',
        }}>
          ...
        </div>
      )}

      {/* Hair */}
      <div style={{ position: 'relative', width: 14, margin: '0 auto' }}>
        {hairVariant === 0 && (
          <div style={{ width: 14, height: 4, background: hairColor, borderRadius: '2px 2px 0 0' }} />
        )}
        {hairVariant === 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
            <div style={{ width: 3, height: 6, background: hairColor, borderRadius: '1px 1px 0 0' }} />
            <div style={{ width: 3, height: 7, background: hairColor, borderRadius: '1px 1px 0 0' }} />
            <div style={{ width: 3, height: 5, background: hairColor, borderRadius: '1px 1px 0 0' }} />
          </div>
        )}
        {hairVariant === 2 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <div style={{ width: 5, height: 4, background: hairColor, borderRadius: '2px 0 0 0' }} />
            <div style={{ width: 5, height: 4, background: hairColor, borderRadius: '0 2px 0 0' }} />
          </div>
        )}
      </div>

      {/* Head */}
      <div style={{
        width: 14,
        height: 12,
        backgroundColor: skinColor,
        margin: '0 auto',
        position: 'relative',
        imageRendering: 'pixelated',
      }}>
        {/* Eyes */}
        <div style={{
          position: 'absolute',
          top: 3,
          left: 2,
          width: 2,
          height: 2,
          backgroundColor: stateColor,
          boxShadow: `0 0 3px ${stateColor}66`,
        }} />
        <div style={{
          position: 'absolute',
          top: 3,
          right: 2,
          width: 2,
          height: 2,
          backgroundColor: stateColor,
          boxShadow: `0 0 3px ${stateColor}66`,
        }} />
        {/* Mouth */}
        <div style={{
          position: 'absolute',
          bottom: 2,
          left: 4,
          width: 6,
          height: 1,
          backgroundColor: `${skinColor}88`,
          borderRadius: 1,
        }} />
      </div>

      {/* Body */}
      <div style={{
        width: 12,
        height: 14,
        backgroundColor: outfitColor,
        margin: '1px auto 0',
        borderRadius: '0 0 2px 2px',
        position: 'relative',
        boxShadow: `0 0 6px ${outfitColor}33`,
      }}>
        {/* Collar */}
        <div style={{
          width: 12,
          height: 2,
          backgroundColor: `${outfitColor}cc`,
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }} />
        {/* Arms */}
        <div style={{
          position: 'absolute',
          left: -4,
          top: 1,
          width: 3,
          height: 10,
          backgroundColor: outfitColor,
          borderRadius: 1,
          animation: agent.state === 'working' ? 'spriteWork 0.6s ease-in-out infinite' : undefined,
        }} />
        <div style={{
          position: 'absolute',
          right: -4,
          top: 1,
          width: 3,
          height: 10,
          backgroundColor: outfitColor,
          borderRadius: 1,
        }} />
        {/* Coffee cup in hand */}
        {agent.state === 'coffee' && (
          <div style={{
            position: 'absolute',
            right: -8,
            top: 4,
            width: 5,
            height: 5,
            backgroundColor: '#ddd',
            borderRadius: 1,
          }} />
        )}
      </div>

      {/* Legs */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        <div style={{ width: 4, height: 4, backgroundColor: '#2a2a4a', borderRadius: '0 0 1px 1px' }} />
        <div style={{ width: 4, height: 4, backgroundColor: '#2a2a4a', borderRadius: '0 0 1px 1px' }} />
      </div>

      {/* State indicator dot */}
      <div style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        backgroundColor: stateColor,
        margin: '3px auto 0',
        boxShadow: `0 0 6px ${stateColor}88`,
        animation: 'pulseGlow 2s ease-in-out infinite',
      }} />

      {/* Name */}
      <div style={{
        fontSize: 7,
        fontFamily: 'var(--hatch-font-display)',
        color: '#ccc',
        marginTop: 2,
        whiteSpace: 'nowrap',
        textShadow: `0 0 4px ${stateColor}44`,
      }}>
        {agent.displayName}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 4,
          background: 'rgba(6, 6, 17, 0.92)',
          border: '1px solid var(--hatch-border-default)',
          borderRadius: 6,
          padding: '6px 10px',
          whiteSpace: 'nowrap',
          zIndex: 20,
          animation: 'fadeIn 0.15s ease-out',
        }}>
          <div style={{
            fontSize: 8,
            fontFamily: 'var(--hatch-font-display)',
            color: stateColor,
            marginBottom: 3,
          }}>
            {agent.displayName}
          </div>
          <div style={{
            fontSize: 10,
            fontFamily: 'var(--hatch-font-body)',
            color: 'var(--hatch-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: stateColor,
              display: 'inline-block',
            }} />
            {agent.state}
          </div>
        </div>
      )}
    </div>
  );
}
