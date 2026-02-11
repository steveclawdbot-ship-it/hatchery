/**
 * Office Canvas with Agents - Enhanced version
 * Combines background scene with agent sprites
 */

'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { drawOfficeScene } from './office-scene';
import AgentSprite from './agent-sprite';
import { GRID_CONFIG } from './desk-assignments';
import { VisualAgent, AgentState } from '@/lib/types/rpg';

interface OfficeCanvasWithAgentsProps {
  time?: Date;
  agents?: VisualAgent[];
  selectedAgentId?: string | null;
  onAgentClick?: (agentId: string) => void;
  onDeskClick?: (deskId: number) => void;
}

// Demo agents for development
const DEMO_AGENTS: VisualAgent[] = [
  { id: 'steve', displayName: 'Steve', state: 'typing', x: 80, y: 120, deskId: 1, level: 8, class: 'Sage', currentTask: 'Analyzing data...', lastActive: new Date() },
  { id: 'sam', displayName: 'Sam', state: 'researching', x: 480, y: 120, deskId: 2, level: 6, class: 'Commander', currentTask: 'Reviewing metrics', lastActive: new Date() },
  { id: 'luna', displayName: 'Luna', state: 'chatting', x: 80, y: 220, deskId: 3, level: 7, class: 'Artisan', currentTask: 'Designing UI', lastActive: new Date() },
  { id: 'leo', displayName: 'Leo', state: 'thinking', x: 480, y: 220, deskId: 4, level: 5, class: 'Ranger', currentTask: 'Planning sprint', lastActive: new Date() },
];

// Agent theme colors
const AGENT_COLORS: Record<string, string> = {
  steve: '#4caf50', // Green (research)
  sam: '#2196f3',   // Blue (data)
  luna: '#e91e63',  // Pink (creative)
  leo: '#ff9800',   // Orange (engineering)
};

export default function OfficeCanvasWithAgents({
  time = new Date(),
  agents = DEMO_AGENTS,
  selectedAgentId = null,
  onAgentClick,
  onDeskClick,
}: OfficeCanvasWithAgentsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const animationRef = useRef<number>();

  // Handle canvas click for desk selection
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onDeskClick) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check which desk was clicked
    const desks = [
      { id: 1, x: 80, y: 120 },
      { id: 2, x: 480, y: 120 },
      { id: 3, x: 80, y: 220 },
      { id: 4, x: 480, y: 220 },
      { id: 5, x: 280, y: 280 },
      { id: 6, x: 480, y: 280 },
    ];

    for (const desk of desks) {
      const hitX = x >= desk.x - 40 && x <= desk.x + 40;
      const hitY = y >= desk.y - 30 && y <= desk.y + 30;
      if (hitX && hitY) {
        onDeskClick(desk.id);
        break;
      }
    }
  }, [onDeskClick]);

  // Draw the office scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    const draw = () => {
      drawOfficeScene(ctx, time);
    };

    draw();
    setIsReady(true);

    // Animation loop for subtle effects
    let frameCount = 0;
    const animate = () => {
      frameCount++;
      if (frameCount % 30 === 0) {
        draw();
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [time]);

  return (
    <div 
      style={{ 
        position: 'relative',
        display: 'inline-block',
        border: '4px solid #2a2a5a',
        borderRadius: 4,
        backgroundColor: '#1a1a3a',
      }}
    >
      {/* Background canvas */}
      <canvas
        ref={canvasRef}
        width={GRID_CONFIG.width}
        height={GRID_CONFIG.height}
        onClick={handleCanvasClick}
        style={{
          display: 'block',
          imageRendering: 'pixelated',
          cursor: onDeskClick ? 'pointer' : 'default',
        }}
      />

      {/* Agent sprites overlaid on canvas */}
      {agents.map((agent) => (
        <AgentSprite
          key={agent.id}
          agentId={agent.id}
          displayName={agent.displayName}
          state={agent.state}
          x={agent.x}
          y={agent.y - 20} // Offset to stand at desk
          color={AGENT_COLORS[agent.id] || '#9e9e9e'}
          isSelected={selectedAgentId === agent.id}
          onClick={() => onAgentClick?.(agent.id)}
        />
      ))}

      {!isReady && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#7c5cff',
          fontSize: 12,
          fontFamily: '"Press Start 2P", monospace',
        }}>
          Loading...
        </div>
      )}
    </div>
  );
}
