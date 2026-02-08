'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import type { PitchSession, ChatMessage, Round } from '@/lib/pitch/types';
import { PITCH_ROUNDS } from '@/lib/pitch/prompts';
import ChatWindow from '@/components/pitch/chat-window';
import InputArea from '@/components/pitch/input-area';
import RoundProgress from '@/components/pitch/round-progress';
import SynthesisPanel from '@/components/pitch/synthesis-panel';
import GenerationProgress from '@/components/pitch/generation-progress';

export default function PitchSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<PitchSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [canSynthesize, setCanSynthesize] = useState(false);

  // Load session data
  const loadSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/pitch/${sessionId}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/pitch');
          return;
        }
        throw new Error('Failed to load session');
      }
      const data: PitchSession = await res.json();
      setSession(data);
      setCanSynthesize(data.current_round > 4 || data.rounds.length >= 4);

      // Convert rounds to chat messages
      const chatMessages: ChatMessage[] = [];
      for (const round of data.rounds) {
        chatMessages.push({
          id: `founder-${round.round}`,
          role: 'founder',
          content: round.founderInput,
          round: round.round,
          timestamp: data.created_at, // Approximate
        });
        chatMessages.push({
          id: `vc-${round.round}`,
          role: 'vc',
          content: round.vcResponse,
          round: round.round,
          focus: round.focus,
          timestamp: data.created_at, // Approximate
        });
      }
      setMessages(chatMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    }
  }, [sessionId, router]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Send message and stream response
  async function handleSend(message: string) {
    if (!session || isStreaming) return;

    setIsStreaming(true);
    setError('');

    // Add founder message immediately
    const founderId = `founder-${Date.now()}`;
    const founderMessage: ChatMessage = {
      id: founderId,
      role: 'founder',
      content: message,
      round: session.current_round,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, founderMessage]);

    // Add placeholder for VC response
    const vcId = `vc-${Date.now()}`;
    const vcMessage: ChatMessage = {
      id: vcId,
      role: 'vc',
      content: '',
      round: session.current_round,
      focus: PITCH_ROUNDS[session.current_round - 1]?.focus,
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, vcMessage]);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/pitch/${sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        throw new Error('Failed to get response');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      setIsLoading(false);

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
                // Update streaming message content
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === vcId ? { ...m, content: m.content + data.chunk } : m
                  )
                );
              }

              if (data.done) {
                // Mark streaming complete
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === vcId ? { ...m, isStreaming: false } : m
                  )
                );

                // Update session state
                if (data.canSynthesize) {
                  setCanSynthesize(true);
                }
                if (data.nextRound) {
                  setSession((prev) =>
                    prev ? { ...prev, current_round: data.nextRound } : prev
                  );
                }

                // Reload session to get updated rounds
                await loadSession();
              }

              if (data.error) {
                throw new Error(data.error);
              }
            } catch (parseErr) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove the failed VC message
      setMessages((prev) => prev.filter((m) => m.id !== vcId));
    } finally {
      setIsStreaming(false);
      setIsLoading(false);
    }
  }

  // Handle synthesis request
  async function handleSynthesize() {
    if (!session) return;

    try {
      // Update session status to synthesis
      const res = await fetch(`/api/pitch/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'synthesis' }),
      });

      if (!res.ok) throw new Error('Failed to start synthesis');

      await loadSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start synthesis');
    }
  }

  // Handle approval
  async function handleApproval(approved: boolean, editedPitch?: string) {
    if (!session) return;

    try {
      const res = await fetch(`/api/pitch/${sessionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, editedPitch }),
      });

      if (!res.ok) throw new Error('Failed to process approval');

      await loadSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process approval');
    }
  }

  if (!session) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: 8, color: '#7a7a92' }}>Loading session...</div>
      </div>
    );
  }

  // Show generation progress for generation/completed states
  if (session.status === 'generation' || session.status === 'completed') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <RoundProgress currentRound={session.current_round} status={session.status} />
        <GenerationProgress session={session} onRefresh={loadSession} />
      </div>
    );
  }

  // Show synthesis/approval panel
  if (session.status === 'synthesis' || session.status === 'approval') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <RoundProgress currentRound={session.current_round} status={session.status} />
        <SynthesisPanel
          session={session}
          onApprove={handleApproval}
          onRefresh={loadSession}
        />
      </div>
    );
  }

  // Main chat interface
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <RoundProgress currentRound={session.current_round} status={session.status} />

      {error && (
        <div
          style={{
            padding: '10px 16px',
            background: '#301010',
            borderBottom: '1px solid #5f2b2b',
            fontSize: 7,
            color: '#ff8f8f',
          }}
        >
          {error}
        </div>
      )}

      <ChatWindow messages={messages} isLoading={isLoading} />

      {/* Synthesize button */}
      {canSynthesize && !isStreaming && (
        <div
          style={{
            padding: '12px 16px',
            background: '#0f0f25',
            borderTop: '1px solid #1a1a3a',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={handleSynthesize}
            style={{
              fontSize: 7,
              padding: '10px 20px',
              background: '#FF980033',
              border: '1px solid #FF9800',
              borderRadius: 4,
              color: '#FF9800',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Ready to Synthesize? Skip remaining rounds →
          </button>
        </div>
      )}

      <InputArea
        onSend={handleSend}
        disabled={isStreaming}
        placeholder={
          session.current_round === 1
            ? 'Pitch your AI startup idea...'
            : 'Respond to the VC\'s question...'
        }
      />
    </div>
  );
}
