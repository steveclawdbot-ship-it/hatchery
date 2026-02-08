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
            background: isVC ? '#7c5cff33' : '#1a1a3a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}
        >
          {isVC ? '🎩' : '👤'}
        </div>
        <span style={{ fontSize: 12, color: '#7a7a92' }}>
          {isVC ? 'VC Partner' : 'You'}
        </span>
        {message.focus && isVC && (
          <span
            style={{
              fontSize: 11,
              color: '#7c5cff',
              padding: '4px 10px',
              background: '#7c5cff22',
              borderRadius: 4,
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
          background: isVC ? '#1a1a3a' : '#0f0f25',
          border: isVC ? '1px solid #7c5cff44' : '1px solid #2a2a5a',
          borderTopLeftRadius: isVC ? 0 : 12,
          borderTopRightRadius: isVC ? 12 : 0,
        }}
      >
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: '#e0e0e0',
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
                background: '#7c5cff',
                marginLeft: 2,
                animation: 'blink 1s infinite',
              }}
            />
          )}
        </div>
      </div>

      {/* Timestamp */}
      <span
        style={{
          fontSize: 10,
          color: '#4a4a6a',
          marginTop: 6,
          paddingLeft: isVC ? 46 : 0,
          paddingRight: isVC ? 0 : 46,
        }}
      >
        {new Date(message.timestamp).toLocaleTimeString()}
      </span>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
