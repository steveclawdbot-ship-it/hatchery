'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import AgentSprite from './agent-sprite';

interface Agent {
  id: string;
  displayName: string;
  state: 'working' | 'chatting' | 'coffee' | 'celebrating' | 'idle';
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  fadeDir: number;
}

export default function PixelOffice() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [time, setTime] = useState(new Date());
  const [dimensions, setDimensions] = useState({ width: 960, height: 320 });

  // Responsive canvas sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timeout: ReturnType<typeof setTimeout>;
    const obs = new ResizeObserver(([entry]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) setDimensions({ width: w, height: 320 });
      }, 80);
    });
    obs.observe(el);
    return () => { obs.disconnect(); clearTimeout(timeout); };
  }, []);

  // Initialize particles
  useEffect(() => {
    const particles: Particle[] = [];
    for (let i = 0; i < 20; i++) {
      particles.push({
        x: Math.random() * dimensions.width,
        y: Math.random() * 280,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.2 - 0.05,
        alpha: Math.random() * 0.4,
        size: Math.random() < 0.3 ? 2 : 1,
        fadeDir: Math.random() < 0.5 ? 1 : -1,
      });
    }
    particlesRef.current = particles;
  }, [dimensions.width]);

  // Fetch agents
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch('/api/agents');
        if (res.ok) {
          const data = await res.json();
          setAgents(data);
        }
      } catch {
        setAgents([
          { id: 'coordinator', displayName: 'Boss', state: 'working', x: 0, y: 0 },
          { id: 'analyst', displayName: 'Brain', state: 'chatting', x: 0, y: 0 },
          { id: 'creative', displayName: 'Pixel', state: 'coffee', x: 0, y: 0 },
          { id: 'social', displayName: 'Buzz', state: 'celebrating', x: 0, y: 0 },
        ]);
      }
    };
    fetchAgents();
    const interval = setInterval(fetchAgents, 30000);
    return () => clearInterval(interval);
  }, []);

  // Time cycle
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Draw office + animate particles
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    const hour = time.getHours();
    const isNight = hour < 6 || hour > 20;
    const isSunset = hour >= 17 && hour < 20;

    ctx.clearRect(0, 0, width, height);

    // --- Sky ---
    const skyColors = getSkyColors(hour);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 90);
    skyGrad.addColorStop(0, skyColors.top);
    skyGrad.addColorStop(1, skyColors.bottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, 90);

    // Stars at night
    if (isNight) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 30; i++) {
        const sx = (i * 47 + 13) % width;
        const sy = (i * 29 + 7) % 80;
        const size = i % 5 === 0 ? 2 : 1;
        ctx.globalAlpha = 0.4 + (i % 3) * 0.2;
        ctx.fillRect(sx, sy, size, size);
      }
      ctx.globalAlpha = 1;
    }

    // --- Building exterior wall ---
    ctx.fillStyle = '#12122a';
    ctx.fillRect(0, 70, width, 10);

    // --- Interior ---
    const interiorTint = isSunset ? '#1a1530' : isNight ? '#0f0f22' : '#1a1a3a';
    ctx.fillStyle = interiorTint;
    ctx.fillRect(0, 80, width, height - 80);

    // --- Floor ---
    const floorGrad = ctx.createLinearGradient(0, height - 70, 0, height);
    floorGrad.addColorStop(0, '#1e1e40');
    floorGrad.addColorStop(1, '#252545');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, height - 70, width, 70);

    // Floor grid
    ctx.strokeStyle = '#2a2a5a';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, height - 70);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = height - 70; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // --- Windows ---
    const windowSpacing = Math.max(120, width / 6);
    const windowColor = isNight ? '#FFD70022' : isSunset ? '#FF8C5033' : '#87CEEB33';
    const windowGlow = isNight ? '#FFD70011' : 'transparent';
    for (let x = 50; x < width - 50; x += windowSpacing) {
      // Window glow
      if (isNight) {
        ctx.fillStyle = windowGlow;
        ctx.fillRect(x - 4, 6, 72, 62);
      }
      ctx.fillStyle = windowColor;
      ctx.fillRect(x, 10, 64, 54);
      ctx.strokeStyle = '#3a3a6a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, 10, 64, 54);
      // Window dividers
      ctx.beginPath();
      ctx.moveTo(x + 32, 10);
      ctx.lineTo(x + 32, 64);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, 37);
      ctx.lineTo(x + 64, 37);
      ctx.stroke();
    }

    // --- Ceiling lamps ---
    const lampSpacing = Math.max(200, width / 4);
    for (let x = lampSpacing / 2; x < width; x += lampSpacing) {
      // Cord
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.lineTo(x, 100);
      ctx.stroke();
      // Lamp shade
      ctx.fillStyle = '#2a2a4a';
      ctx.fillRect(x - 10, 100, 20, 6);
      // Light glow
      if (!isNight || true) {
        ctx.fillStyle = isNight
          ? 'rgba(255, 200, 100, 0.06)'
          : isSunset
            ? 'rgba(255, 160, 80, 0.04)'
            : 'rgba(255, 255, 200, 0.03)';
        ctx.beginPath();
        ctx.moveTo(x - 40, height - 70);
        ctx.lineTo(x - 8, 106);
        ctx.lineTo(x + 8, 106);
        ctx.lineTo(x + 40, height - 70);
        ctx.fill();
      }
      // Bulb
      ctx.fillStyle = isNight ? '#FFD080' : '#FFFFCC';
      ctx.fillRect(x - 2, 106, 4, 3);
    }

    // --- Desks ---
    const deskCount = Math.max(2, Math.floor(width / 200));
    const deskSpacing = width / (deskCount + 1);
    for (let i = 0; i < deskCount; i++) {
      const dx = deskSpacing * (i + 1) - 40;
      const dy = 190;
      // Desk surface
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(dx, dy, 80, 8);
      // Legs
      ctx.fillRect(dx + 4, dy + 8, 4, 22);
      ctx.fillRect(dx + 72, dy + 8, 4, 22);
      // Monitor
      ctx.fillStyle = '#111';
      ctx.fillRect(dx + 24, dy - 28, 32, 24);
      ctx.fillStyle = isNight ? '#00ff4488' : '#00ff4422';
      ctx.fillRect(dx + 26, dy - 26, 28, 20);
      // Monitor stand
      ctx.fillStyle = '#222';
      ctx.fillRect(dx + 37, dy - 4, 6, 4);
      // Keyboard
      ctx.fillStyle = '#222';
      ctx.fillRect(dx + 20, dy - 3, 24, 3);
    }

    // --- Coffee area (right side) ---
    const coffeeX = width - 100;
    // Counter
    ctx.fillStyle = '#2a1e14';
    ctx.fillRect(coffeeX, 186, 60, 8);
    ctx.fillRect(coffeeX + 4, 194, 4, 20);
    ctx.fillRect(coffeeX + 52, 194, 4, 20);
    // Coffee machine
    ctx.fillStyle = '#333';
    ctx.fillRect(coffeeX + 15, 168, 20, 18);
    ctx.fillStyle = '#666';
    ctx.fillRect(coffeeX + 18, 172, 14, 10);
    // Red light
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(coffeeX + 32, 170, 2, 2);
    // Cup
    ctx.fillStyle = '#ddd';
    ctx.fillRect(coffeeX + 40, 178, 8, 8);
    // Steam
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#fff';
    const steamOffset = Math.sin(Date.now() / 800) * 2;
    ctx.fillRect(coffeeX + 42 + steamOffset, 170, 2, 6);
    ctx.fillRect(coffeeX + 46 - steamOffset, 168, 2, 8);
    ctx.globalAlpha = 1;

    // --- Plant (left corner) ---
    const plantX = 24;
    // Pot
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(plantX, 198, 16, 16);
    ctx.fillRect(plantX - 2, 196, 20, 4);
    // Soil
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(plantX + 2, 196, 12, 3);
    // Leaves
    ctx.fillStyle = '#2d7a3a';
    ctx.fillRect(plantX + 4, 184, 4, 12);
    ctx.fillRect(plantX - 2, 178, 8, 6);
    ctx.fillRect(plantX + 10, 180, 8, 6);
    ctx.fillStyle = '#3a9a4a';
    ctx.fillRect(plantX + 2, 174, 6, 6);
    ctx.fillRect(plantX + 8, 176, 6, 6);

    // --- Ambient particles ---
    const particles = particlesRef.current;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha += p.fadeDir * 0.005;
      if (p.alpha >= 0.5) p.fadeDir = -1;
      if (p.alpha <= 0.05) p.fadeDir = 1;

      // Wrap
      if (p.y < 80) { p.y = height - 80; p.x = Math.random() * width; }
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = isNight ? '#5ce1ff' : '#ffffff';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    animFrameRef.current = requestAnimationFrame(draw);
  }, [dimensions, time]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  // Distribute agents across desks proportionally
  const { width } = dimensions;
  const deskCount = Math.max(2, Math.floor(width / 200));
  const deskSpacing = width / (deskCount + 1);

  const positionedAgents = agents.map((agent, i) => ({
    ...agent,
    x: deskSpacing * ((i % deskCount) + 1) - 8,
    y: i < deskCount ? 120 : 125,
  }));

  return (
    <div
      ref={containerRef}
      className="crt-overlay"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#0a0a1a',
      }}
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
        }}
      />

      {/* Agent sprites overlaid */}
      {positionedAgents.map((agent, i) => (
        <AgentSprite key={agent.id} agent={agent} index={i} />
      ))}

      {/* Status HUD overlay */}
      <div style={{
        position: 'absolute',
        top: 8,
        right: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        background: 'rgba(6, 6, 17, 0.7)',
        borderRadius: 4,
        border: '1px solid rgba(42, 42, 90, 0.5)',
        zIndex: 4,
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--hatch-success)',
          boxShadow: '0 0 6px rgba(76, 175, 80, 0.6)',
          display: 'inline-block',
        }} />
        <span style={{
          fontSize: 8,
          fontFamily: 'var(--hatch-font-display)',
          color: 'var(--hatch-text-muted)',
          letterSpacing: 1,
        }}>
          {agents.length} AGENTS
        </span>
        <span style={{
          fontSize: 8,
          fontFamily: 'var(--hatch-font-body)',
          color: 'var(--hatch-text-muted)',
        }}>
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

function getSkyColors(hour: number): { top: string; bottom: string } {
  if (hour >= 6 && hour < 8) return { top: '#FF6B6B', bottom: '#FFA07A' };
  if (hour >= 8 && hour < 17) return { top: '#4A90D9', bottom: '#87CEEB' };
  if (hour >= 17 && hour < 20) return { top: '#FF6B6B', bottom: '#4A2060' };
  return { top: '#08081e', bottom: '#12122e' };
}
