'use client';

import { useRef, useEffect, useState } from 'react';

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

export default function RelationshipGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);

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
          setNodes(agents.map((a: { id: string; displayName: string }, i: number) => ({
            id: a.id,
            displayName: a.displayName,
            x: 200 + Math.cos(i * Math.PI * 2 / agents.length) * 120,
            y: 200 + Math.sin(i * Math.PI * 2 / agents.length) * 120,
            vx: 0, vy: 0,
          })));
          setLinks(rels);
        }
      } catch {
        // Demo data
        const demoNodes: Node[] = [
          { id: 'boss', displayName: 'Boss', x: 200, y: 100, vx: 0, vy: 0 },
          { id: 'brain', displayName: 'Brain', x: 320, y: 200, vx: 0, vy: 0 },
          { id: 'pixel', displayName: 'Pixel', x: 200, y: 300, vx: 0, vy: 0 },
          { id: 'buzz', displayName: 'Buzz', x: 80, y: 200, vx: 0, vy: 0 },
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
  }, []);

  // Simple force simulation
  useEffect(() => {
    if (!nodes.length) return;

    let animFrame: number;
    const simulate = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Simple force-directed layout
      const updated = [...nodes];
      for (let i = 0; i < updated.length; i++) {
        for (let j = i + 1; j < updated.length; j++) {
          const dx = updated[j].x - updated[i].x;
          const dy = updated[j].y - updated[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);

          // Repulsion
          const repulsion = 2000 / (dist * dist);
          const fx = (dx / dist) * repulsion;
          const fy = (dy / dist) * repulsion;
          updated[i].vx -= fx;
          updated[i].vy -= fy;
          updated[j].vx += fx;
          updated[j].vy += fy;
        }

        // Center gravity
        updated[i].vx += (200 - updated[i].x) * 0.01;
        updated[i].vy += (200 - updated[i].y) * 0.01;

        // Damping
        updated[i].vx *= 0.9;
        updated[i].vy *= 0.9;
        updated[i].x += updated[i].vx;
        updated[i].y += updated[i].vy;
      }

      // Attraction from links
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

      // Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw links
      for (const link of links) {
        const source = updated.find((n) => n.id === link.source);
        const target = updated.find((n) => n.id === link.target);
        if (!source || !target) continue;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = link.affinity > 0.6 ? '#4CAF5066' : link.affinity < 0.4 ? '#F4433666' : '#FFF33366';
        ctx.lineWidth = link.affinity * 4;
        ctx.stroke();

        // Affinity label
        ctx.fillStyle = '#666';
        ctx.font = '8px "Press Start 2P"';
        ctx.fillText(
          link.affinity.toFixed(2),
          (source.x + target.x) / 2 - 10,
          (source.y + target.y) / 2 - 4,
        );
      }

      // Draw nodes
      for (const node of updated) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#7c5cff';
        ctx.fill();
        ctx.strokeStyle = '#5a3cdd';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '6px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText(node.displayName, node.x, node.y + 28);
      }

      animFrame = requestAnimationFrame(simulate);
    };

    simulate();
    return () => cancelAnimationFrame(animFrame);
  }, [nodes.length, links]);

  return (
    <div>
      <h2 style={{ fontSize: 10, marginBottom: 16 }}>Relationship Graph</h2>
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        style={{
          border: '1px solid #2a2a5a',
          borderRadius: 4,
          backgroundColor: '#0a0a1a',
        }}
      />
      <div style={{ marginTop: 8, fontSize: 6, color: '#666', display: 'flex', gap: 16 }}>
        <span><span style={{ color: '#4CAF50' }}>━━</span> High affinity ({'>'} 0.6)</span>
        <span><span style={{ color: '#FFF333' }}>━━</span> Neutral (0.4–0.6)</span>
        <span><span style={{ color: '#F44336' }}>━━</span> Tension ({'<'} 0.4)</span>
      </div>
    </div>
  );
}
