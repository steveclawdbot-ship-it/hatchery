'use client';

import { useEffect, useState, useCallback } from 'react';

interface Message {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  content: string;
  type: 'chat' | 'dm' | 'system';
  timestamp: string;
}

interface SpeechBubble {
  id: string;
  agentId: string;
  content: string;
  x: number;
  y: number;
  expiresAt: number;
  isExpanded: boolean;
}

interface MessageLine {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  type: 'chat' | 'dm' | 'system';
  progress: number;
}

interface CommunicationsLayerProps {
  messages: Message[];
  agentPositions: Record<string, { x: number; y: number; color: string }>;
  onMessageClick?: (message: Message) => void;
}

const BUBBLE_DURATION = 5000; // 5 seconds
const MAX_BUBBLE_CHARS = 40;
const LINE_ANIMATION_DURATION = 1000;

export default function CommunicationsLayer({
  messages,
  agentPositions,
  onMessageClick,
}: CommunicationsLayerProps) {
  const [bubbles, setBubbles] = useState<SpeechBubble[]>([]);
  const [lines, setLines] = useState<MessageLine[]>([]);

  // Process new messages
  useEffect(() => {
    if (messages.length === 0) return;

    const latestMessage = messages[messages.length - 1];
    const fromPos = agentPositions[latestMessage.fromAgentId];
    const toPos = agentPositions[latestMessage.toAgentId];

    if (!fromPos) return;

    // Create speech bubble
    const bubble: SpeechBubble = {
      id: `bubble-${latestMessage.id}`,
      agentId: latestMessage.fromAgentId,
      content: latestMessage.content,
      x: fromPos.x,
      y: fromPos.y - 50, // Above agent
      expiresAt: Date.now() + BUBBLE_DURATION,
      isExpanded: false,
    };

    setBubbles((prev) => [...prev, bubble].slice(-10)); // Keep last 10

    // Create message line if there's a recipient
    if (toPos && latestMessage.fromAgentId !== latestMessage.toAgentId) {
      const line: MessageLine = {
        id: `line-${latestMessage.id}`,
        fromX: fromPos.x,
        fromY: fromPos.y - 20,
        toX: toPos.x,
        toY: toPos.y - 20,
        color: getLineColor(latestMessage.type, fromPos.color),
        type: latestMessage.type,
        progress: 0,
      };

      setLines((prev) => [...prev, line]);

      // Animate line
      animateLine(line.id);
    }
  }, [messages, agentPositions]);

  // Animate message line
  const animateLine = useCallback((lineId: string) => {
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / LINE_ANIMATION_DURATION, 1);

      setLines((prev) =>
        prev.map((l) => (l.id === lineId ? { ...l, progress } : l))
      );

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Remove line after animation
        setTimeout(() => {
          setLines((prev) => prev.filter((l) => l.id !== lineId));
        }, 500);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  // Cleanup expired bubbles
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setBubbles((prev) => prev.filter((b) => b.expiresAt > now));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getLineColor = (type: string, agentColor: string): string => {
    switch (type) {
      case 'dm':
        return '#ff9800';
      case 'system':
        return '#9c27b0';
      default:
        return agentColor;
    }
  };

  const truncateContent = (content: string, maxChars: number): string => {
    if (content.length <= maxChars) return content;
    return content.slice(0, maxChars - 3) + '...';
  };

  const toggleBubble = (bubbleId: string) => {
    setBubbles((prev) =>
      prev.map((b) =>
        b.id === bubbleId ? { ...b, isExpanded: !b.isExpanded } : b
      )
    );
  };

  // Calculate bezier curve path
  const getBezierPath = (line: MessageLine): string => {
    const midX = (line.fromX + line.toX) / 2;
    const midY = Math.min(line.fromY, line.toY) - 50; // Curve upward
    return `M ${line.fromX} ${line.fromY} Q ${midX} ${midY} ${line.toX} ${line.toY}`;
  };

  // Calculate path length for animation
  const getPathLength = (line: MessageLine): number => {
    // Approximate bezier length
    const dx = line.toX - line.fromX;
    const dy = line.toY - line.fromY;
    return Math.sqrt(dx * dx + dy * dy) * 1.2;
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {/* SVG Layer for message lines */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {lines.map((line) => {
          const path = getBezierPath(line);
          const pathLength = getPathLength(line);

          return (
            <g key={line.id}>
              {/* Glow effect */}
              <path
                d={path}
                fill="none"
                stroke={line.color}
                strokeWidth={4}
                opacity={0.3}
                style={{
                  filter: 'blur(2px)',
                }}
              />
              {/* Main line */}
              <path
                d={path}
                fill="none"
                stroke={line.color}
                strokeWidth={2}
                strokeDasharray={pathLength}
                strokeDashoffset={pathLength * (1 - line.progress)}
                style={{
                  transition: 'stroke-dashoffset 0.1s linear',
                }}
              />
              {/* Animated dash pattern */}
              <path
                d={path}
                fill="none"
                stroke="#fff"
                strokeWidth={1}
                strokeDasharray="4 4"
                strokeDashoffset={-Date.now() / 50} // Animate dashes
                opacity={0.6}
              />
            </g>
          );
        })}
      </svg>

      {/* Speech Bubbles */}
      {bubbles.map((bubble) => {
        const agent = agentPositions[bubble.agentId];
        if (!agent) return null;

        const displayContent = bubble.isExpanded
          ? bubble.content
          : truncateContent(bubble.content, MAX_BUBBLE_CHARS);

        return (
          <div
            key={bubble.id}
            onClick={() => toggleBubble(bubble.id)}
            style={{
              position: 'absolute',
              left: bubble.x,
              top: bubble.y,
              transform: 'translateX(-50%)',
              backgroundColor: '#252545',
              border: `2px solid ${agent.color}`,
              borderRadius: 12,
              padding: '8px 12px',
              maxWidth: bubble.isExpanded ? 200 : 140,
              pointerEvents: 'auto',
              cursor: 'pointer',
              boxShadow: `0 4px 12px ${agent.color}33`,
              animation: 'fadeIn 0.3s ease',
              zIndex: 10,
            }}
          >
            {/* Bubble tail */}
            <div
              style={{
                position: 'absolute',
                bottom: -8,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: `8px solid ${agent.color}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: -5,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid #252545',
              }}
            />

            {/* Content */}
            <div
              style={{
                fontSize: 10,
                color: '#ccc',
                lineHeight: 1.4,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {displayContent}
            </div>

            {/* Expand hint */}
            {!bubble.isExpanded && bubble.content.length > MAX_BUBBLE_CHARS && (
              <div
                style={{
                  fontSize: 8,
                  color: agent.color,
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                Click to expand
              </div>
            )}

            {/* Expiration indicator */}
            <div
              style={{
                position: 'absolute',
                bottom: 2,
                right: 4,
                width: 20,
                height: 2,
                backgroundColor: '#333',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: agent.color,
                  transform: `scaleX(${(bubble.expiresAt - Date.now()) / BUBBLE_DURATION})`,
                  transformOrigin: 'left',
                  transition: 'transform 0.1s linear',
                }}
              />
            </div>
          </div>
        );
      })}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
