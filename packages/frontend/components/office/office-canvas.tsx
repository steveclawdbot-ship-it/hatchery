/**
 * Office Canvas - Main canvas component
 * Renders the pixel-art office environment
 */

'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { drawOfficeScene } from './office-scene';
import { GRID_CONFIG } from './desk-assignments';

interface OfficeCanvasProps {
  time?: Date;
  onDeskClick?: (deskId: number) => void;
}

export default function OfficeCanvas({ time = new Date(), onDeskClick }: OfficeCanvasProps) {
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

    // Check which desk was clicked (simple hit detection)
    // Desk areas are roughly 80x60px centered on desk positions
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

    // Disable anti-aliasing for pixel art
    ctx.imageSmoothingEnabled = false;

    // Draw the scene
    drawOfficeScene(ctx, time);
    setIsReady(true);

    // Animation loop for subtle effects
    let frameCount = 0;
    const animate = () => {
      frameCount++;
      // Redraw every 30 frames (~500ms at 60fps) for subtle updates
      if (frameCount % 30 === 0) {
        drawOfficeScene(ctx, time);
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
      <canvas
        ref={canvasRef}
        width={GRID_CONFIG.width}
        height={GRID_CONFIG.height}
        onClick={handleCanvasClick}
        style={{
          display: 'block',
          imageRendering: 'pixelated',
          imageRendering: 'crisp-edges',
          cursor: onDeskClick ? 'pointer' : 'default',
        }}
      />
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
