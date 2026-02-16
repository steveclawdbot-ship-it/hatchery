'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface Node {
  id: string;
  displayName: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Link {
  source: string;
  target: string;
  affinity: number;
}

const NODE_COLORS = ['#7c5cff', '#00e5ff', '#ff5ce1', '#ffb35c', '#5cff8a', '#ff5c5c'];

function hashColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return NODE_COLORS[Math.abs(h) % NODE_COLORS.length];
}

export default function RelationshipGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [canvasWidth, setCanvasWidth] = useState(400);
  const canvasHeight = 380;

  // Responsive width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) setCanvasWidth(w);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsRes, relsRes] = await Promise.all([
          fetch('/api/agents'),
          fetch('/api/relationships'),
        ]);
        if (agentsRes.ok && relsRes.ok) {
          const agents = await agentsRes.json();
          const rels = await relsRes.json();
          const cx = canvasWidth / 2;
          const cy = canvasHeight / 2;
          setNodes(agents.map((a: { id: string; displayName: string }, i: number) => ({
            id: a.id,
            displayName: a.displayName,
            x: cx + Math.cos(i * Math.PI * 2 / agents.length) * 120,
            y: cy + Math.sin(i * Math.PI * 2 / agents.length) * 120,
            vx: 0, vy: 0,
          })));
          setLinks(rels);
        }
      } catch {
        const cx = canvasWidth / 2;
        const cy = canvasHeight / 2;
        const demoNodes: Node[] = [
          { id: 'boss', displayName: 'Boss', x: cx, y: cy - 100, vx: 0, vy: 0 },
          { id: 'brain', displayName: 'Brain', x: cx + 120, y: cy, vx: 0, vy: 0 },
          { id: 'pixel', displayName: 'Pixel', x: cx, y: cy + 100, vx: 0, vy: 0 },
          { id: 'buzz', displayName: 'Buzz', x: cx - 120, y: cy, vx: 0, vy: 0 },
        ];
        setNodes(demoNodes);
        setLinks([
          { source: 'boss', target: 'brain', affinity: 0.8 },
          { source: 'boss', target: 'pixel', affinity: 0.5 },
          { source: 'brain', target: 'pixel', affinity: 0.7 },
          { source: 'brain', target: 'buzz', affinity: 0.3 },
          { source: 'pixel', target: 'buzz', affinity: 0.6 },
          { source: 'boss', target: 'buzz', affinity: 0.65 },
        ]);
      }
    };
    fetchData();
  }, [canvasWidth]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;

    // Force simulation
    const updated = [...nodes];
    for (let i = 0; i < updated.length; i++) {
      for (let j = i + 1; j < updated.length; j++) {
        const dx = updated[j].x - updated[i].x;
        const dy = updated[j].y - updated[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);

        const repulsion = 2000 / (dist * dist);
        const fx = (dx / dist) * repulsion;
        const fy = (dy / dist) * repulsion;
        updated[i].vx -= fx;
        updated[i].vy -= fy;
        updated[j].vx += fx;
        updated[j].vy += fy;
      }

      updated[i].vx += (cx - updated[i].x) * 0.01;
      updated[i].vy += (cy - updated[i].y) * 0.01;

      updated[i].vx *= 0.9;
      updated[i].vy *= 0.9;
      updated[i].x += updated[i].vx;
      updated[i].y += updated[i].vy;
    }

    for (const link of links) {
      const source = updated.find((n) => n.id === link.source);
      const target = updated.find((n) => n.id === link.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const strength = (dist - 100) * 0.005 * link.affinity;

      source.vx += (dx / dist) * strength;
      source.vy += (dy / dist) * strength;
      target.vx -= (dx / dist) * strength;
      target.vy -= (dy / dist) * strength;
    }

    setNodes(updated);

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Faint grid background
    ctx.strokeStyle = 'rgba(124, 92, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw links
    for (const link of links) {
      const source = updated.find((n) => n.id === link.source);
      const target = updated.find((n) => n.id === link.target);
      if (!source || !target) continue;

      const linkColor = link.affinity > 0.6
        ? 'rgba(76, 175, 80, 0.5)'
        : link.affinity < 0.4
          ? 'rgba(244, 67, 54, 0.5)'
          : 'rgba(255, 243, 51, 0.4)';

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = linkColor;
      ctx.lineWidth = link.affinity * 3;
      ctx.shadowColor = linkColor;
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Affinity label
      ctx.fillStyle = 'rgba(200, 200, 220, 0.5)';
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        link.affinity.toFixed(2),
        (source.x + target.x) / 2,
        (source.y + target.y) / 2 - 6,
      );
    }

    // Draw nodes
    for (const node of updated) {
      const color = hashColor(node.id);

      // Outer glow
      ctx.beginPath();
      ctx.arc(node.x, node.y, 16, 0, Math.PI * 2);
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'transparent';
      ctx.fill();
      ctx.shadowBlur = 0;

      // Node fill
      ctx.beginPath();
      ctx.arc(node.x, node.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.2;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Node border
      ctx.beginPath();
      ctx.arc(node.x, node.y, 14, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner dot
      ctx.beginPath();
      ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Label
      ctx.fillStyle = '#e0e0f0';
      ctx.font = '500 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fillText(node.displayName, node.x, node.y + 28);
      ctx.shadowBlur = 0;
    }
  }, [nodes, links, canvasWidth]);

  useEffect(() => {
    if (!nodes.length) return;

    let animFrame: number;
    const simulate = () => {
      draw();
      animFrame = requestAnimationFrame(simulate);
    };

    simulate();
    return () => cancelAnimationFrame(animFrame);
  }, [nodes.length, links, draw]);

  return (
    <div style={{ animation: 'slideUp 0.4s ease-out' }}>
      <h2 style={{
        fontSize: 13,
        fontFamily: 'var(--hatch-font-display)',
        color: 'var(--hatch-text-primary)',
        marginBottom: 16,
      }}>
        RELATIONSHIP GRAPH
      </h2>
      <div
        ref={containerRef}
        style={{
          border: '1px solid var(--hatch-border-default)',
          borderRadius: 8,
          overflow: 'hidden',
          background: 'var(--hatch-bg-surface)',
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{
            display: 'block',
            width: '100%',
            height: canvasHeight,
            imageRendering: 'auto',
          }}
        />
      </div>
      <div style={{
        marginTop: 10,
        fontSize: 10,
        fontFamily: 'var(--hatch-font-body)',
        color: 'var(--hatch-text-muted)',
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <span><span style={{ color: 'var(--hatch-success)' }}>━━</span> High affinity ({'>'} 0.6)</span>
        <span><span style={{ color: 'var(--hatch-warning)' }}>━━</span> Neutral (0.4–0.6)</span>
        <span><span style={{ color: 'var(--hatch-danger)' }}>━━</span> Tension ({'<'} 0.4)</span>
      </div>
    </div>
  );
}
