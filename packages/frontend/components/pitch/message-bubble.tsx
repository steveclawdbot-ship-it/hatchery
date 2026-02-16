'use client';

import type { ChatMessage } from '@/lib/pitch/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isVC = message.role === 'vc';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isVC ? 'flex-start' : 'flex-end',
        marginBottom: 24,
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      {/* Avatar and label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
          flexDirection: isVC ? 'row' : 'row-reverse',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            background: isVC ? 'rgba(124, 92, 255, 0.15)' : 'var(--hatch-bg-surface)',
            border: `1px solid ${isVC ? 'rgba(124, 92, 255, 0.3)' : 'var(--hatch-border-default)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}
        >
          {isVC ? '🎩' : '👤'}
        </div>
        <span style={{
          fontSize: 12,
          fontFamily: 'var(--hatch-font-body)',
          color: 'var(--hatch-text-muted)',
        }}>
          {isVC ? 'Strategy Guide' : 'You'}
        </span>
        {message.focus && isVC && (
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--hatch-font-display)',
              color: 'var(--hatch-accent-primary)',
              padding: '4px 10px',
              background: 'rgba(124, 92, 255, 0.1)',
              borderRadius: 4,
              textShadow: '0 0 6px rgba(124, 92, 255, 0.3)',
            }}
          >
            {message.focus}
          </span>
        )}
      </div>

      {/* Message bubble */}
      <div
        style={{
          maxWidth: '85%',
          padding: '16px 20px',
          borderRadius: 12,
          background: isVC ? 'rgba(10, 10, 26, 0.85)' : 'var(--hatch-bg-surface)',
          backdropFilter: isVC ? 'blur(12px)' : undefined,
          border: isVC ? '1px solid rgba(124, 92, 255, 0.25)' : '1px solid var(--hatch-border-default)',
          borderTopLeftRadius: isVC ? 0 : 12,
          borderTopRightRadius: isVC ? 12 : 0,
          boxShadow: isVC ? '0 2px 12px rgba(124, 92, 255, 0.08)' : undefined,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontFamily: 'var(--hatch-font-body)',
            lineHeight: 1.7,
            color: 'var(--hatch-text-primary)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.content}
          {message.isStreaming && (
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 16,
                background: 'var(--hatch-accent-primary)',
                marginLeft: 2,
                animation: 'blink 1s infinite',
                boxShadow: '0 0 6px rgba(124, 92, 255, 0.5)',
              }}
            />
          )}
        </div>
      </div>

      {/* Timestamp */}
      <span
        style={{
          fontSize: 10,
          fontFamily: 'var(--hatch-font-body)',
          color: 'var(--hatch-text-muted)',
          marginTop: 6,
          paddingLeft: isVC ? 46 : 0,
          paddingRight: isVC ? 0 : 46,
        }}
      >
        {new Date(message.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}
