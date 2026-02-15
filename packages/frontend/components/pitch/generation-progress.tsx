'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import type { PitchSession, Agent } from '@/lib/pitch/types';

interface GenerationProgressProps {
  session: PitchSession;
  onRefresh: () => void;
}

type GenerationStep = 'agents' | 'workers' | 'strategy' | 'configs';

interface StepConfig {
  id: GenerationStep;
  label: string;
  description: string;
}

const GENERATION_STEPS: StepConfig[] = [
  { id: 'agents', label: 'Agent Team', description: 'Generating your AI agent personalities...' },
  { id: 'workers', label: 'Work Modules', description: 'Configuring step kinds and triggers...' },
  { id: 'strategy', label: 'Strategy', description: 'Writing your STRATEGY.md...' },
  { id: 'configs', label: 'Configurations', description: 'Generating final config files...' },
];

export default function GenerationProgress({ session, onRefresh }: GenerationProgressProps) {
  const [currentStep, setCurrentStep] = useState<GenerationStep | null>(null);
  const [completedSteps, setCompletedSteps] = useState<GenerationStep[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  // Start/resume generation if needed
  useEffect(() => {
    if (session.status === 'completed') {
      setCompletedSteps(['agents', 'workers', 'strategy', 'configs']);
      setCurrentStep(null);
      return;
    }

    if (session.status !== 'generation') {
      return;
    }

    const completed: GenerationStep[] = [];
    if (session.agent_config) completed.push('agents');
    if (session.worker_config) completed.push('workers');
    if (session.strategy) completed.push('strategy');
    if (session.configs) completed.push('configs');
    setCompletedSteps(completed);

    if (!session.configs && !isGenerating && !error) {
      startGeneration();
    }
  }, [
    session.status,
    session.agent_config,
    session.worker_config,
    session.strategy,
    session.configs,
    isGenerating,
    error,
  ]);

  async function startGeneration() {
    setIsGenerating(true);
    setError('');

    try {
      const res = await fetch(`/api/pitch/${session.id}/generate`, {
        method: 'POST',
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(
          payload?.error && typeof payload.error === 'string'
            ? payload.error
            : 'Failed to start generation'
        );
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            let data: Record<string, unknown>;
            try {
              data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            } catch {
              continue;
            }

            if (typeof data.error === 'string' && data.error) {
              throw new Error(data.error);
            }

            if (data.step === 'agents' || data.step === 'workers' || data.step === 'strategy' || data.step === 'configs') {
              setCurrentStep(data.step);
            }

            const completed = data.completed;
            if (
              completed === 'agents' ||
              completed === 'workers' ||
              completed === 'strategy' ||
              completed === 'configs'
            ) {
              setCompletedSteps((prev) => (prev.includes(completed) ? prev : [...prev, completed]));
              setCurrentStep(null);
            }

            if (data.done === true) {
              onRefresh();
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }

  function downloadConfigs() {
    if (!session.configs) return;

    // Create a simple JSON download with all configs
    const blob = new Blob([JSON.stringify(session.configs, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.startup_name || 'hatchery'}-configs.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isComplete = session.status === 'completed';

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
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>
            {isComplete ? '🎉' : '⚙️'}
          </div>
          <h2 style={{ fontSize: 18, margin: '0 0 8px 0', color: '#e0e0e0' }}>
            {isComplete ? 'Your AI Startup is Ready!' : 'Generating Your AI Team'}
          </h2>
          <p style={{ fontSize: 12, color: '#7a7a92', margin: 0 }}>
            {isComplete
              ? `${session.startup_name} is ready to launch.`
              : 'This may take a minute or two...'}
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: 12,
              background: '#301010',
              border: '1px solid #5f2b2b',
              borderRadius: 6,
              fontSize: 11,
              color: '#ff8f8f',
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}
        {error && session.status === 'generation' && !isGenerating && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <button
              onClick={startGeneration}
              style={{
                ...downloadButtonStyle,
                background: '#1a1a3a',
                color: '#9aa0ff',
              }}
            >
              Retry Generation
            </button>
          </div>
        )}

        {/* Progress steps */}
        <div
          style={{
            background: '#0f0f25',
            border: '1px solid #2a2a5a',
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
          }}
        >
          {GENERATION_STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = currentStep === step.id;

            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '12px 0',
                  borderBottom:
                    index < GENERATION_STEPS.length - 1 ? '1px solid #1a1a3a' : 'none',
                }}
              >
                {/* Status indicator */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: isCompleted
                      ? '#4CAF50'
                      : isCurrent
                      ? '#7c5cff'
                      : '#2a2a5a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: '#fff',
                  }}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>

                {/* Step info */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: isCompleted || isCurrent ? '#e0e0e0' : '#7a7a92',
                      marginBottom: 2,
                    }}
                  >
                    {step.label}
                  </div>
                  {isCurrent && (
                    <div style={{ fontSize: 11, color: '#7c5cff' }}>
                      {step.description}
                    </div>
                  )}
                </div>

                {/* Spinner for current step */}
                {isCurrent && (
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      border: '2px solid #2a2a5a',
                      borderTopColor: '#7c5cff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Agent preview (if available) */}
        {session.agent_config && (
          <div
            style={{
              background: '#0f0f25',
              border: '1px solid #2a2a5a',
              borderRadius: 8,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <h3 style={{ fontSize: 16, margin: '0 0 16px 0', color: '#e0e0e0' }}>
              Your Agent Team
            </h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {session.agent_config.agents.map((agent: Agent) => (
                <div
                  key={agent.id}
                  style={{
                    padding: 12,
                    background: '#1a1a3a',
                    borderRadius: 6,
                    border: '1px solid #2a2a5a',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 12 }}>
                      {agent.canInitiate ? '⚡' : '💭'}
                    </span>
                    <span style={{ fontSize: 13, color: '#e0e0e0' }}>
                      {agent.displayName}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: '#7a7a92',
                        padding: '2px 6px',
                        background: '#0f0f25',
                        borderRadius: 3,
                      }}
                    >
                      {agent.id}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#7c5cff', marginBottom: 4 }}>
                    {agent.role}
                  </div>
                  <div style={{ fontSize: 11, color: '#7a7a92' }}>
                    {agent.tone} • &quot;{agent.quirk}&quot;
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Download button */}
        {isComplete && session.configs && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button onClick={downloadConfigs} style={downloadButtonStyle}>
              Download Configurations
            </button>
            <button
              onClick={() => (window.location.href = '/pitch')}
              style={{
                ...downloadButtonStyle,
                background: '#1a1a3a',
                color: '#9aa0ff',
              }}
            >
              Start New Pitch
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const downloadButtonStyle: CSSProperties = {
  fontSize: 12,
  padding: '14px 28px',
  background: '#7c5cff',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
