'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/lib/pitch/types';
import MessageBubble from './message-bubble';
import TypingIndicator from './typing-indicator';

interface ChatWindowProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

export default function ChatWindow({ messages, isLoading = false }: ChatWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ maxWidth: 900, width: '100%', margin: '0 auto' }}>
        {messages.length === 0 && !isLoading && (
          <div
            style={{
              textAlign: 'center',
              padding: 60,
              color: '#7a7a92',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 20 }}>🎩</div>
            <div style={{ fontSize: 18, marginBottom: 12 }}>
              Welcome to the Pitch Room
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              Start by pitching your AI startup idea.
              <br />
              Your VC-style guide will turn the story into executable goals, missions, and tasks.
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isLoading && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
