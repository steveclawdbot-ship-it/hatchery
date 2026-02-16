'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { PitchSession, Agent } from '@/lib/pitch/types';
import { getLaunchReadiness } from '@/lib/pitch/activation';

interface GenerationProgressProps {
  session: PitchSession;
  onRefresh: () => void;
}

type GenerationStep = 'agents' | 'workers' | 'strategy' | 'configs';
type ActivationState = 'idle' | 'activating' | 'confirm_replace' | 'success' | 'error';

interface StepConfig {
  id: GenerationStep;
  label: string;
  description: string;
}

interface ActivationAutoRunPayload {
  attempted?: boolean;
  succeeded?: boolean;
  error?: string | null;
  result?: {
    skipped?: boolean;
    reason?: string;
    stepsExecuted?: number;
    stepsFailed?: number;
    stepsRecovered?: number;
  } | null;
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
  const [activationState, setActivationState] = useState<ActivationState>('idle');
  const [activationMessage, setActivationMessage] = useState('');
  const [activationMissionId, setActivationMissionId] = useState<string | null>(null);

  const readiness = getLaunchReadiness(session);

  // Start/resume generation if needed
  const startGeneration = useCallback(async () => {
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

            if (
              data.step === 'agents' ||
              data.step === 'workers' ||
              data.step === 'strategy' ||
              data.step === 'configs'
            ) {
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
              await Promise.resolve(onRefresh());
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [session.id, onRefresh]);

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
    startGeneration,
  ]);

  useEffect(() => {
    if (session.status !== 'completed') {
      setActivationState('idle');
      setActivationMessage('');
      setActivationMissionId(null);
      return;
    }

    if (session.activated_at) {
      setActivationState('success');
      setActivationMissionId(session.activation_mission_id ?? null);
      setActivationMessage(
        `Startup activated at ${new Date(session.activated_at).toLocaleString()}.`,
      );
    }
  }, [session.status, session.activated_at, session.activation_mission_id]);

  async function activateStartup(forceReplace: boolean) {
    setActivationState('activating');
    setActivationMessage('');

    try {
      const res = await fetch(`/api/pitch/${session.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReplace, autoRunNow: true }),
      });
      const payload = await res.json().catch(() => null);

      if (res.status === 409 && payload?.requiresConfirmation === true) {
        setActivationState('confirm_replace');
        setActivationMessage(
          payload?.error && typeof payload.error === 'string'
            ? payload.error
            : 'Runtime configuration already exists. Confirm replacement to continue.',
        );
        return;
      }

      if (!res.ok) {
        throw new Error(
          payload?.error && typeof payload.error === 'string'
            ? payload.error
            : 'Activation failed',
        );
      }

      const missionId =
        payload?.missionId && typeof payload.missionId === 'string'
          ? payload.missionId
          : null;
      const autoRun = parseActivationAutoRun(payload?.autoRun);
      setActivationMissionId(missionId);
      setActivationState('success');
      setActivationMessage(
        buildActivationMessage(payload?.replacedExisting === true, autoRun),
      );
      await Promise.resolve(onRefresh());
    } catch (err) {
      setActivationState('error');
      setActivationMessage(err instanceof Error ? err.message : 'Activation failed');
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
  const isActivated = activationState === 'success' || Boolean(session.activated_at);

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
            {isComplete ? (isActivated ? '🚀' : '🎉') : '⚙️'}
          </div>
          <h2 style={{ fontSize: 18, margin: '0 0 8px 0', color: '#e0e0e0' }}>
            {isComplete
              ? isActivated
                ? 'Your AI Startup Is Active'
                : 'Your AI Startup Is Ready'
              : 'Generating Your AI Team'}
          </h2>
          <p style={{ fontSize: 12, color: '#7a7a92', margin: 0 }}>
            {isComplete
              ? isActivated
                ? `${session.startup_name} is running with live runtime config.`
                : `${session.startup_name} is ready to activate.`
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

        {isComplete && (
          <div
            style={{
              background: '#0f0f25',
              border: '1px solid #2a2a5a',
              borderRadius: 8,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <h3 style={{ fontSize: 16, margin: '0 0 14px 0', color: '#e0e0e0' }}>
              Launch Readiness
            </h3>
            <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
              {readiness.checks.map((check) => (
                <div
                  key={check.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: check.ready ? '#9fe3b7' : '#ffb2b2',
                  }}
                >
                  <span>{check.ready ? '✓' : '✕'}</span>
                  <span>{check.label}</span>
                </div>
              ))}
            </div>

            {!readiness.ready && (
              <div style={activationHintStyle}>
                Activation is blocked until all readiness checks pass.
              </div>
            )}

            {activationMessage && (
              <div
                style={{
                  ...activationHintStyle,
                  borderColor: activationState === 'error' ? '#5f2b2b' : '#2b5f44',
                  background: activationState === 'error' ? '#301010' : '#103020',
                  color: activationState === 'error' ? '#ff8f8f' : '#7fe0a8',
                }}
              >
                {activationMessage}
                {activationMissionId ? ` Mission: ${activationMissionId}` : ''}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {activationState === 'confirm_replace' ? (
                <>
                  <button
                    onClick={() => activateStartup(true)}
                    style={{
                      ...downloadButtonStyle,
                      padding: '10px 18px',
                      background: '#7f3a1a',
                    }}
                  >
                    Replace Existing Runtime
                  </button>
                  <button
                    onClick={() => {
                      setActivationState('idle');
                      setActivationMessage('');
                    }}
                    style={{
                      ...downloadButtonStyle,
                      padding: '10px 18px',
                      background: '#1a1a3a',
                      color: '#9aa0ff',
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => activateStartup(false)}
                  disabled={!readiness.ready || activationState === 'activating' || isActivated}
                  style={{
                    ...downloadButtonStyle,
                    padding: '10px 18px',
                    opacity: !readiness.ready || activationState === 'activating' || isActivated ? 0.7 : 1,
                    cursor: !readiness.ready || activationState === 'activating' || isActivated
                      ? 'not-allowed'
                      : 'pointer',
                  }}
                >
                  {isActivated
                    ? 'Startup Activated'
                    : activationState === 'activating'
                      ? 'Activating...'
                      : 'Activate Startup'}
                </button>
              )}

              <button
                onClick={() => (window.location.href = '/')}
                style={{
                  ...downloadButtonStyle,
                  padding: '10px 18px',
                  background: '#1a1a3a',
                  color: '#9aa0ff',
                }}
              >
                Open Dashboard
              </button>
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

const activationHintStyle: CSSProperties = {
  border: '1px solid #2a2a5a',
  background: '#101030',
  padding: 10,
  fontSize: 11,
  color: '#aab0d0',
  borderRadius: 6,
  marginBottom: 12,
};

function parseActivationAutoRun(value: unknown): ActivationAutoRunPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const result = v.result;
  const parsedResult =
    result && typeof result === 'object' && !Array.isArray(result)
      ? (() => {
        const r = result as Record<string, unknown>;
        return {
          skipped: r.skipped === true,
          reason: typeof r.reason === 'string' ? r.reason : undefined,
          stepsExecuted: asNumberOrUndefined(r.stepsExecuted),
          stepsFailed: asNumberOrUndefined(r.stepsFailed),
          stepsRecovered: asNumberOrUndefined(r.stepsRecovered),
        };
      })()
      : null;

  return {
    attempted: v.attempted === true,
    succeeded: v.succeeded === true,
    error: typeof v.error === 'string' ? v.error : null,
    result: parsedResult,
  };
}

function buildActivationMessage(
  replacedExisting: boolean,
  autoRun: ActivationAutoRunPayload | null,
): string {
  const prefix = replacedExisting
    ? 'Startup activated. Existing runtime configuration was replaced.'
    : 'Startup activated. Runtime is now live.';

  if (!autoRun?.attempted) {
    return prefix;
  }

  if (autoRun.succeeded) {
    if (autoRun.result?.skipped) {
      const reason = autoRun.result.reason ?? 'no-op';
      return `${prefix} Auto-run skipped (${reason}); use Control Panel to run now.`;
    }

    const executed = autoRun.result?.stepsExecuted ?? 0;
    const failed = autoRun.result?.stepsFailed ?? 0;
    const recovered = autoRun.result?.stepsRecovered ?? 0;
    return `${prefix} First mission bootstrap executed (${executed} succeeded, ${failed} failed, ${recovered} recovered).`;
  }

  const error = autoRun.error ?? 'unknown error';
  return `${prefix} Auto-run failed (${error}); use Control Panel to run now.`;
}

function asNumberOrUndefined(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
