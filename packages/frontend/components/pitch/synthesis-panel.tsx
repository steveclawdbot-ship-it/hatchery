'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import type { PitchSession } from '@/lib/pitch/types';

interface SynthesisPanelProps {
  session: PitchSession;
  onApprove: (approved: boolean, editedPitch?: string) => void;
  onRefresh: () => void;
}

export default function SynthesisPanel({ session, onApprove, onRefresh }: SynthesisPanelProps) {
  const [revisedPitch, setRevisedPitch] = useState(session.revised_pitch || '');
  const [isEditing, setIsEditing] = useState(false);
  const [editedPitch, setEditedPitch] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState('');

  // Start synthesis if needed
  useEffect(() => {
    if (session.status === 'synthesis' && !session.revised_pitch) {
      startSynthesis();
    }
  }, [session.status, session.revised_pitch]);

  async function startSynthesis() {
    setIsSynthesizing(true);
    setError('');

    try {
      const res = await fetch(`/api/pitch/${session.id}/synthesize`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to start synthesis');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullPitch = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.chunk) {
                fullPitch += data.chunk;
                setRevisedPitch(fullPitch);
              }

              if (data.done) {
                onRefresh();
              }

              if (data.error) {
                throw new Error(data.error);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Synthesis failed');
    } finally {
      setIsSynthesizing(false);
    }
  }

  async function handleApprove() {
    setIsApproving(true);
    try {
      await onApprove(true);
    } finally {
      setIsApproving(false);
    }
  }

  async function handleEdit() {
    setIsEditing(true);
    setEditedPitch(revisedPitch);
  }

  async function handleSaveEdit() {
    setIsApproving(true);
    try {
      await onApprove(true, editedPitch);
    } finally {
      setIsApproving(false);
      setIsEditing(false);
    }
  }

  async function handleRedo() {
    setRevisedPitch('');
    await startSynthesis();
  }

  return (
    <div
      style={{
        flex: 1,
        padding: 24,
        overflowY: 'auto',
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 12, margin: '0 0 8px 0', color: '#e0e0e0' }}>
            {isSynthesizing ? 'Synthesizing Your Pitch...' : 'Revised Pitch'}
          </h2>
          <p style={{ fontSize: 7, color: '#7a7a92', margin: 0 }}>
            {isSynthesizing
              ? 'The VC is distilling your pitch meeting into a refined brief.'
              : 'Review and approve or edit the synthesized pitch.'}
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: 12,
              background: '#301010',
              border: '1px solid #5f2b2b',
              borderRadius: 6,
              fontSize: 7,
              color: '#ff8f8f',
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Pitch display */}
        <div
          style={{
            background: '#0f0f25',
            border: '1px solid #2a2a5a',
            borderRadius: 8,
            padding: 20,
            marginBottom: 20,
            minHeight: 300,
          }}
        >
          {isEditing ? (
            <textarea
              value={editedPitch}
              onChange={(e) => setEditedPitch(e.target.value)}
              style={textareaStyle}
            />
          ) : (
            <pre
              style={{
                fontSize: 7,
                lineHeight: 1.8,
                color: '#e0e0e0',
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                margin: 0,
              }}
            >
              {revisedPitch || (
                <span style={{ color: '#4a4a6a' }}>Generating revised pitch...</span>
              )}
              {isSynthesizing && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 10,
                    background: '#7c5cff',
                    marginLeft: 2,
                    animation: 'blink 1s infinite',
                  }}
                />
              )}
            </pre>
          )}
        </div>

        {/* Action buttons */}
        {!isSynthesizing && revisedPitch && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  disabled={isApproving}
                  style={{
                    ...buttonStyle,
                    background: '#4CAF50',
                    color: '#fff',
                  }}
                >
                  {isApproving ? 'Saving...' : 'Save & Approve'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={isApproving}
                  style={{
                    ...buttonStyle,
                    background: '#2a2a5a',
                    color: '#9aa0ff',
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleApprove}
                  disabled={isApproving}
                  style={{
                    ...buttonStyle,
                    background: '#4CAF50',
                    color: '#fff',
                  }}
                >
                  {isApproving ? 'Processing...' : 'Approve & Generate'}
                </button>
                <button
                  onClick={handleEdit}
                  disabled={isApproving}
                  style={{
                    ...buttonStyle,
                    background: '#2a2a5a',
                    color: '#9aa0ff',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={handleRedo}
                  disabled={isApproving}
                  style={{
                    ...buttonStyle,
                    background: '#1a1a3a',
                    color: '#7a7a92',
                  }}
                >
                  Redo
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

const buttonStyle: CSSProperties = {
  fontSize: 8,
  padding: '12px 24px',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: 400,
  fontSize: 7,
  lineHeight: 1.8,
  padding: 0,
  background: 'transparent',
  border: 'none',
  color: '#e0e0e0',
  fontFamily: 'inherit',
  resize: 'vertical',
  outline: 'none',
};
