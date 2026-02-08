'use client';

import { useRef, useEffect, useState } from 'react';
import AgentSprite from './agent-sprite';

interface Agent {
  id: string;
  displayName: string;
  state: 'working' | 'chatting' | 'coffee' | 'celebrating' | 'idle';
  x: number;
  y: number;
}

export default function PixelOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [time, setTime] = useState(new Date());

  // Fetch agents and their states
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch('/api/agents');
        if (res.ok) {
          const data = await res.json();
          setAgents(data);
        }
      } catch {
        // Demo agents for development
        setAgents([
          { id: 'coordinator', displayName: 'Boss', state: 'working', x: 120, y: 100 },
          { id: 'analyst', displayName: 'Brain', state: 'chatting', x: 300, y: 100 },
          { id: 'creative', displayName: 'Pixel', state: 'coffee', x: 480, y: 100 },
          { id: 'social', displayName: 'Buzz', state: 'working', x: 120, y: 250 },
        ]);
      }
    };

    fetchAgents();
    const interval = setInterval(fetchAgents, 30000);
    return () => clearInterval(interval);
  }, []);

  // Time cycle for sky color
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Draw office background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const hour = time.getHours();

    // Sky gradient based on time
    const skyColors = getSkyColors(hour);
    const gradient = ctx.createLinearGradient(0, 0, 0, 80);
    gradient.addColorStop(0, skyColors.top);
    gradient.addColorStop(1, skyColors.bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, 80);

    // Building
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(0, 80, canvas.width, canvas.height - 80);

    // Floor
    ctx.fillStyle = '#252545';
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);

    // Grid lines (tile pattern)
    ctx.strokeStyle = '#2a2a5a';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, canvas.height - 60);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = canvas.height - 60; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Windows
    ctx.fillStyle = hour >= 6 && hour <= 18 ? '#87CEEB44' : '#FFD70033';
    for (let x = 40; x < canvas.width; x += 160) {
      ctx.fillRect(x, 10, 60, 50);
      ctx.strokeStyle = '#3a3a6a';
      ctx.strokeRect(x, 10, 60, 50);
      ctx.beginPath();
      ctx.moveTo(x + 30, 10);
      ctx.lineTo(x + 30, 60);
      ctx.stroke();
    }

    // Desks
    ctx.fillStyle = '#3a2a1a';
    const deskPositions = [100, 280, 460];
    for (const dx of deskPositions) {
      // Desk top
      ctx.fillRect(dx, 180, 80, 8);
      // Desk legs
      ctx.fillRect(dx + 5, 188, 4, 20);
      ctx.fillRect(dx + 71, 188, 4, 20);
      // Monitor
      ctx.fillStyle = '#111';
      ctx.fillRect(dx + 25, 155, 30, 22);
      ctx.fillStyle = '#0f0';
      ctx.fillRect(dx + 27, 157, 26, 18);
      ctx.fillStyle = '#3a2a1a';
    }

    // Stars at night
    if (hour < 6 || hour > 20) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 20; i++) {
        const sx = (i * 37 + 13) % canvas.width;
        const sy = (i * 23 + 7) % 70;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }
  }, [time]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        style={{
          border: '2px solid #2a2a5a',
          borderRadius: 4,
          imageRendering: 'pixelated',
        }}
      />
      {/* Agent sprites overlaid on canvas */}
      {agents.map((agent) => (
        <AgentSprite key={agent.id} agent={agent} />
      ))}
    </div>
  );
}

function getSkyColors(hour: number): { top: string; bottom: string } {
  if (hour >= 6 && hour < 8) return { top: '#FF6B6B', bottom: '#FFA07A' };
  if (hour >= 8 && hour < 17) return { top: '#4A90D9', bottom: '#87CEEB' };
  if (hour >= 17 && hour < 20) return { top: '#FF6B6B', bottom: '#4A2060' };
  return { top: '#0a0a2a', bottom: '#1a1a3a' };
}
