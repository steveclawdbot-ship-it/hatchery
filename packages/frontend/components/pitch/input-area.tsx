'use client';

import { useState, useRef, useEffect, type CSSProperties } from 'react';

interface InputAreaProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function InputArea({ onSend, disabled = false, placeholder }: InputAreaProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  function handleSend() {
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setMessage('');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      style={{
        padding: 20,
        background: '#0a0a1a',
        borderTop: '1px solid #1a1a3a',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'flex-end',
          maxWidth: 900,
          margin: '0 auto',
        }}
      >
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Type your response...'}
          disabled={disabled}
          style={textareaStyle}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          style={{
            ...buttonStyle,
            opacity: disabled || !message.trim() ? 0.5 : 1,
            cursor: disabled || !message.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          Send
        </button>
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#4a4a6a',
          textAlign: 'center',
          marginTop: 12,
        }}
      >
        Press <kbd style={kbdStyle}>⌘</kbd> + <kbd style={kbdStyle}>Enter</kbd> to send
      </div>
    </div>
  );
}

const textareaStyle: CSSProperties = {
  flex: 1,
  fontSize: 14,
  padding: '16px 18px',
  background: '#111129',
  border: '1px solid #2a2a5a',
  borderRadius: 8,
  color: '#f0f0f5',
  fontFamily: 'inherit',
  outline: 'none',
  resize: 'none',
  minHeight: 56,
  maxHeight: 200,
  lineHeight: 1.6,
};

const buttonStyle: CSSProperties = {
  fontSize: 14,
  padding: '16px 28px',
  background: '#7c5cff',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  fontFamily: 'inherit',
  minHeight: 56,
};

const kbdStyle: CSSProperties = {
  padding: '3px 6px',
  background: '#1a1a3a',
  borderRadius: 3,
  fontSize: 10,
};
