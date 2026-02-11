/**
 * Agent Sprite - Stardew-style 16x24 pixel character
 * 10 states with unique animations
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { AgentState } from '@/lib/types/rpg';

interface AgentSpriteProps {
  agentId: string;
  displayName: string;
  state: AgentState;
  x: number;
  y: number;
  color: string; // Agent's theme color
  isSelected?: boolean;
  onClick?: () => void;
}

// State colors (can be overridden by agent color)
const STATE_COLORS: Record<AgentState, string> = {
  idle: '#9e9e9e',
  typing: '#4caf50',
  thinking: '#2196f3',
  researching: '#9c27b0',
  chatting: '#ff9800',
  calling: '#00bcd4',
  coffee: '#795548',
  celebrating: '#e91e63',
  stuck: '#f44336',
  commuting: '#607d8b',
};

// State emojis for quick visualization
const STATE_EMOJI: Record<AgentState, string> = {
  idle: '💤',
  typing: '⌨️',
  thinking: '🤔',
  researching: '🔍',
  chatting: '💬',
  calling: '📞',
  coffee: '☕',
  celebrating: '🎉',
  stuck: '😰',
  commuting: '🚶',
};

export default function AgentSprite({
  agentId,
  displayName,
  state,
  x,
  y,
  color,
  isSelected = false,
  onClick,
}: AgentSpriteProps) {
  const [frame, setFrame] = useState(0);
  const [bobOffset, setBobOffset] = useState(0);
  const animationRef = useRef<number>();

  // Animation loop
  useEffect(() => {
    let lastTime = 0;
    const frameDuration = 500; // 500ms per frame

    const animate = (timestamp: number) => {
      if (timestamp - lastTime >= frameDuration) {
        setFrame((f) => (f + 1) % 4);
        lastTime = timestamp;

        // Calculate bob offset based on state
        if (state === 'celebrating') {
          setBobOffset(Math.sin(frame * Math.PI / 2) * 4);
        } else if (state === 'typing') {
          setBobOffset(Math.random() > 0.5 ? 1 : 0);
        } else if (state === 'idle') {
          setBobOffset(Math.sin(frame * 0.5) * 1);
        } else {
          setBobOffset(0);
        }
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state, frame]);

  const stateColor = STATE_COLORS[state];
  const displayColor = color || stateColor;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - 8, // Center the 16px sprite
        top: y - 24 + bobOffset, // Account for height + bob
        width: 16,
        height: 24,
        cursor: onClick ? 'pointer' : 'default',
        zIndex: isSelected ? 10 : 1,
        pointerEvents: 'auto',
      }}
      onClick={onClick}
      title={`${displayName} (${state})`}
    >
      {/* Sprite container */}
      <div style={{
        position: 'relative',
        width: 16,
        height: 24,
        imageRendering: 'pixelated',
      }}>
        {/* Render based on state */}
        <SpriteRenderer 
          state={state} 
          color={displayColor} 
          frame={frame}
          isSelected={isSelected}
        />
      </div>

      {/* Name label */}
      <div style={{
        position: 'absolute',
        top: 26,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 6,
        fontFamily: '"Press Start 2P", monospace',
        color: isSelected ? '#7c5cff' : '#ccc',
        whiteSpace: 'nowrap',
        textAlign: 'center',
        textShadow: '1px 1px 0 #000',
      }}>
        {displayName}
      </div>

      {/* State indicator */}
      <div style={{
        position: 'absolute',
        top: -10,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 8,
      }}>
        {STATE_EMOJI[state]}
      </div>

      {/* Selection glow */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: -2,
          left: -2,
          width: 20,
          height: 28,
          border: '2px solid #7c5cff',
          borderRadius: 2,
          boxShadow: '0 0 8px #7c5cff',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}

// Sprite renderer component - renders different pixel art based on state
interface SpriteRendererProps {
  state: AgentState;
  color: string;
  frame: number;
  isSelected: boolean;
}

function SpriteRenderer({ state, color, frame, isSelected }: SpriteRendererProps) {
  const baseColor = color;
  const darkColor = darken(color, 20);
  const lightColor = lighten(color, 20);

  switch (state) {
    case 'idle':
      return <IdleSprite color={baseColor} darkColor={darkColor} frame={frame} />;
    case 'typing':
      return <TypingSprite color={baseColor} darkColor={darkColor} lightColor={lightColor} frame={frame} />;
    case 'thinking':
      return <ThinkingSprite color={baseColor} darkColor={darkColor} frame={frame} />;
    case 'researching':
      return <ResearchingSprite color={baseColor} darkColor={darkColor} frame={frame} />;
    case 'chatting':
      return <ChattingSprite color={baseColor} darkColor={darkColor} frame={frame} />;
    case 'calling':
      return <CallingSprite color={baseColor} darkColor={darkColor} />;
    case 'coffee':
      return <CoffeeSprite color={baseColor} darkColor={darkColor} frame={frame} />;
    case 'celebrating':
      return <CelebratingSprite color={baseColor} darkColor={darkColor} lightColor={lightColor} frame={frame} />;
    case 'stuck':
      return <StuckSprite color={baseColor} darkColor={darkColor} frame={frame} />;
    case 'commuting':
      return <CommutingSprite color={baseColor} darkColor={darkColor} frame={frame} />;
    default:
      return <IdleSprite color={baseColor} darkColor={darkColor} frame={frame} />;
  }
}

// ===== Individual State Sprites =====

// IDLE: Standing, breathing, blinking
function IdleSprite({ color, darkColor, frame }: { color: string; darkColor: string; frame: number }) {
  const blink = frame === 2; // Blink on frame 2
  
  return (
    <svg width="16" height="24" viewBox="0 0 16 24">
      {/* Body */}
      <rect x="4" y="10" width="8" height="10" fill={color} />
      {/* Head */}
      <rect x="2" y="2" width="12" height="10" fill={color} />
      {/* Eyes (blink on frame 2) */}
      {!blink && <rect x="5" y="6" width="2" height="2" fill="#fff" />}
      {!blink && <rect x="9" y="6" width="2" height="2" fill="#fff" />}
      {blink && <rect x="5" y="7" width="2" height="1" fill="#fff" />}
      {blink && <rect x="9" y="7" width="2" height="1" fill="#fff" />}
      {/* Legs */}
      <rect x="4" y="20" width="3" height="4" fill={darkColor} />
      <rect x="9" y="20" width="3" height="4" fill={darkColor} />
    </svg>
  );
}

// TYPING: Seated, hands on keyboard
function TypingSprite({ color, darkColor, lightColor, frame }: { color: string; darkColor: string; lightColor: string; frame: number }) {
  const handOffset = frame % 2 === 0 ? 0 : 1;
  
  return (
    <svg width="16" height="24" viewBox="0 0 16 24">
      {/* Chair back */}
      <rect x="1" y="12" width="3" height="8" fill={darkColor} />
      {/* Body */}
      <rect x="4" y="12" width="8" height="8" fill={color} />
      {/* Head */}
      <rect x="2" y="4" width="12" height="10" fill={color} />
      {/* Eyes */}
      <rect x="5" y="8" width="2" height="2" fill="#fff" />
      <rect x="9" y="8" width="2" height="2" fill="#fff" />
      {/* Hands typing */}
      <rect x={5 + handOffset} y={16} width="2" height="2" fill={lightColor} />
      <rect x={9 - handOffset} y={16} width="2" height="2" fill={lightColor} />
      {/* Keyboard glow */}
      <rect x="6" y="20" width="4" height="1" fill="#0f0" opacity="0.5" />
    </svg>
  );
}

// THINKING: Hand on chin
function ThinkingSprite({ color, darkColor, frame }: { color: string; darkColor: string; frame: number }) {
  const headTilt = frame === 1 || frame === 2 ? 1 : 0;
  
  return (
    <svg width="16" height="24" viewBox="0 0 16 24">
      {/* Body */}
      <rect x="4" y="10" width="8" height="10" fill={color} />
      {/* Head (tilted) */}
      <rect x={2 + headTilt} y="2" width="12" height="10" fill={color} />
      {/* Eyes */}
      <rect x={5 + headTilt} y="6" width="2" height="2" fill="#fff" />
      <rect x={9 + headTilt} y="6" width="2" height="2" fill="#fff" />
      {/* Hand on chin */}
      <rect x="10" y="10" width="3" height="3" fill={darkColor} />
      {/* Thought bubble dots */}
      <circle cx="14" cy="2" r="1" fill="#fff" opacity={frame >= 2 ? 1 : 0.3} />
      <circle cx="12" cy="0" r="0.8" fill="#fff" opacity={frame >= 3 ? 1 : 0.3} />
    </svg>
  );
}

// RESEARCHING: Multiple screens, focused
function ResearchingSprite({ color, darkColor, frame }: { color: string; darkColor: string; frame: number }) {
  const scrollOffset = frame % 4;
  
  return (
    <svg width="16" height="24" viewBox="0 0 16 24">
      {/* Body */}
      <rect x="4" y="10" width="8" height="10" fill={color} />
      {/* Head */}
      <rect x="2" y="2" width="12" height="10" fill={color} />
      {/* Eyes (focused/ narrowed) */}
      <rect x="5" y="7" width="2" height="1" fill="#fff" />
      <rect x="9" y="7" width="2" height="1" fill="#fff" />
      {/* Screen glow on face */}
      <rect x="3" y="4" width="10" height="6" fill="#0f0" opacity="0.2" />
      {/* Multiple screens indicator */}
      <rect x="0" y={8 + scrollOffset} width="2" height="2" fill="#0f0" opacity="0.5" />
      <rect x="14" y={10 - scrollOffset} width="2" height="2" fill="#0f0" opacity="0.5" />
      {/* Legs */}
      <rect x="4" y="20" width="3" height="4" fill={darkColor} />
      <rect x="9" y="20" width="3" height="4" fill={darkColor} />
    </svg>
  );
}

// CHATTING: Turned toward, head bob
function ChattingSprite({ color, darkColor, frame }: { color: string; darkColor: string; frame: number }) {
  const bob = frame % 2 === 0 ? 0 : 1;
  
  return (
    <svg width="16" height="24" viewBox="0 0 16 24">
      {/* Body (slightly angled) */}
      <rect x="4" y="10" width="8" height="10" fill={color} />
      {/* Head */}
      <rect x="2" y={2 + bob} width="12" height="10" fill={color} />
      {/* Eyes */}
      <rect x="5" y={6 + bob} width="2" height="2" fill="#fff" />
      <rect x="9" y={6 + bob} width="2" height="2" fill="#fff" />
      {/* Mouth (talking) */}
      <rect x="6" y={10 + bob} width="4" height={frame % 3 === 0 ? 2 : 1} fill="#fff" />
      {/* Arms gesturing */}
      <rect x="1" y={14 + bob} width="3" height="2" fill={darkColor} />
      <rect x="12" y={14 - bob} width="3" height="2" fill={darkColor} />
    </svg>
  );
}

// CALLING: Phone to ear
function CallingSprite({ color, darkColor }: { color: string; darkColor: string }) {
  return (
    <svg width="16" height="24" viewBox="0 0 16 24">
      {/* Body */}
      <rect x="4" y="10" width="8" height="10" fill={color} />
      {/* Head (tilted for phone) */}
      <rect x="2" y="2" width="12" height="10" fill={color} />
      {/* Eyes */}
      <rect x="5" y="6" width="2" height="2" fill="#fff" />
      <rect x="9" y="6" width="2" height="2" fill="#fff" />
      {/* Phone */}
      <rect x="12" y="4" width="3" height="6" fill="#666" />
      <rect x="13" y="5" width="1" height="4" fill="#0f0" />
    </svg>
  );
}

// COFFEE: Holding cup, sipping
function CoffeeSprite({ color, darkColor, frame }: { color: string; darkColor: string; frame: number }) {
  const sipOffset = frame === 2 ? 1 : 0;
  
  return (
    <svg width="16" height="24" viewBox="0 0 16 24">
      {/* Body */}
      <rect x="4" y="10" width="8" height="10" fill={color} />
      {/* Head */}
      <rect x="2" y="2" width="12" height="10" fill={color} />
      {/* Eyes (happy) */}
      <rect x="5" y="6" width="2" height="2" fill="#fff" />
      <rect x="9" y="6" width="2" height="2" fill="#fff" />
      {/* Coffee cup */}
      <rect x="11" y={12 + sipOffset} width="4" height="4" fill="#8a6a4a" />
      {/* Steam */}
      <rect x="12" y={9 + sipOffset} width="1" height="2" fill="#fff" opacity="0.4" />
      <rect x="14" y={8 + sipOffset} width="1" height="2" fill="#fff" opacity="0.4" />
    </svg>
  );
}

// CELEBRATING: Arms up, jumping
function CelebratingSprite({ color, darkColor, lightColor, frame }: { color: string; darkColor: string; lightColor: string; frame: number }) {
  const armHeight = frame % 2 === 0 ? 8 : 6;
  
  return (
    <svg width="16" height="24" viewBox="0 0 16 24">
      {/* Body */}
      <rect x="4" y="10" width="8" height="8" fill={color} />
      {/* Head */}
      <rect x="2" y="2" width="12" height="10" fill={color} />
      {/* Happy eyes */}
      <rect x="5" y="6" width="2" height="2" fill="#fff" />
      <rect x="9" y="6" width="2" height="2" fill="#fff" />
      {/* Big smile */}
      <rect x="6" y="10" width="4" height="2" fill="#fff" />
      {/* Arms up */}
      <rect x="0" y={armHeight} width="3" height="6" fill={darkColor} />
      <rect x="13" y={armHeight} width="3" height="6" fill={darkColor} />
      {/* Confetti */}
      <rect x="0" y={frame * 2} width="2" height="2" fill="#ff0" />
      <rect x="14" y={frame * 3} width="2" height="2" fill="#f0f" />
      <rect x="7" y={frame} width="2" height="2" fill="#0ff" />
    </svg>
  );
}

// STUCK: Slumped, sweat drop
function StuckSprite({ color, darkColor, frame }: { color: string; darkColor: string; frame: number }) {
  const sweat = frame >= 2;
  
  return (
    <svg width="16" height="24" viewBox="0 0 16 24">
      {/* Body (slumped) */}
      <rect x="4" y="12" width="8" height="8" fill={color} />
      {/* Head (tilted down) */}
      <rect x="3" y="4" width="12" height="10" fill={color} />
      {/* Eyes (dashes = closed/frustrated) */}
      <rect x="5" y="8" width="2" height="1" fill="#fff" />
      <rect x="9" y="8" width="2" height="1" fill="#fff" />
      {/* Hand scratching head */}
      <rect x="12" y="2" width="3" height="3" fill={darkColor} />
      {/* Sweat drop */}
      {sweat && <circle cx="14" cy="4" r="1.5" fill="#0af" />}
    </svg>
  );
}

// COMMUTING: Walking, leg movement
function CommutingSprite({ color, darkColor, frame }: { color: string; darkColor: string; frame: number }) {
  const legOffset = frame % 4;
  const leftLeg = legOffset === 0 || legOffset === 3 ? 4 : 3;
  const rightLeg = legOffset === 1 || legOffset === 2 ? 9 : 10;
  
  return (
    <svg width="16" height="24" viewBox="0 0 16 24">
      {/* Body */}
      <rect x="4" y="8" width="8" height="10" fill={color} />
      {/* Head */}
      <rect x="2" y="2" width="12" height="8" fill={color} />
      {/* Eyes */}
      <rect x="5" y="5" width="2" height="2" fill="#fff" />
      <rect x="9" y="5" width="2" height="2" fill="#fff" />
      {/* Walking legs */}
      <rect x={leftLeg} y="18" width="3" height="4" fill={darkColor} />
      <rect x={rightLeg} y="18" width="3" height="4" fill={darkColor} />
    </svg>
  );
}

// ===== Color utilities =====

function darken(color: string, percent: number): string {
  // Simple darken - in production, use a proper color library
  return color; // Placeholder
}

function lighten(color: string, percent: number): string {
  // Simple lighten - in production, use a proper color library
  return color; // Placeholder
}
