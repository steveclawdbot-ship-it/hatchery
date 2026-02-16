'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

interface RecentSession {
  id: string;
  startup_name: string | null;
  status: string;
  current_round: number;
  created_at: string;
}

type ProviderValue = 'anthropic' | 'openai' | 'google' | 'kimi' | 'zai';

interface ModelOption {
  id: string;
  displayName: string;
}

const PROVIDER_OPTIONS: Array<{ value: ProviderValue; label: string }> = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google' },
  { value: 'kimi', label: 'Kimi' },
  { value: 'zai', label: 'Z.AI' },
];

function isProviderValue(value: string): value is ProviderValue {
  return PROVIDER_OPTIONS.some((option) => option.value === value);
}

function normalizeModelOptions(raw: unknown): ModelOption[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const deduped = new Map<string, ModelOption>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const id = 'id' in entry && typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!id || deduped.has(id)) continue;
    const displayName =
      'displayName' in entry && typeof entry.displayName === 'string' && entry.displayName.trim()
        ? entry.displayName.trim()
        : id;
    deduped.set(id, { id, displayName });
  }

  return Array.from(deduped.values());
}

export default function PitchLanding() {
  const router = useRouter();
  const [startupName, setStartupName] = useState('');
  const [provider, setProvider] = useState<ProviderValue>('anthropic');
  const [model, setModel] = useState('');
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelWarning, setModelWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    loadRecentSessions();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProviderModels() {
      setLoadingModels(true);
      setModelWarning('');

      try {
        const res = await fetch(`/api/pitch/models?provider=${provider}`, { cache: 'no-store' });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            data && typeof data.error === 'string' ? data.error : 'Failed to load model list'
          );
        }

        const options = normalizeModelOptions(data?.models);
        if (cancelled) return;

        setModelOptions(options);
        setModel((current) => {
          if (options.some((option) => option.id === current)) {
            return current;
          }
          return options[0]?.id ?? '';
        });

        if (data && typeof data.warning === 'string' && data.warning.trim().length > 0) {
          setModelWarning(data.warning);
        }
      } catch (err) {
        if (cancelled) return;
        setModelOptions([]);
        setModel('');
        setModelWarning(err instanceof Error ? err.message : 'Failed to load model list');
      } finally {
        if (!cancelled) {
          setLoadingModels(false);
        }
      }
    }

    void loadProviderModels();

    return () => {
      cancelled = true;
    };
  }, [provider]);

  async function loadRecentSessions() {
    try {
      const res = await fetch('/api/pitch/sessions');
      if (res.ok) {
        const data = await res.json();
        setRecentSessions(data.sessions || []);
      }
    } catch {
      // Ignore errors loading recent sessions
    } finally {
      setLoadingSessions(false);
    }
  }

  async function handleStart() {
    if (!startupName.trim()) {
      setError('Please enter a startup name');
      return;
    }

    if (!model) {
      setError('Please select a model');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/pitch/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startup_name: startupName.trim(),
          provider,
          model,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      router.push(`/pitch/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start pitch meeting');
      setLoading(false);
    }
  }

  function handleResume(sessionId: string) {
    router.push(`/pitch/${sessionId}`);
  }

  function getStatusLabel(status: string, round: number): string {
    switch (status) {
      case 'in_progress':
        return `Round ${round}/6`;
      case 'synthesis':
        return 'Synthesizing';
      case 'approval':
        return 'Awaiting Approval';
      case 'generation':
        return 'Generating';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'in_progress':
        return '#7c5cff';
      case 'synthesis':
      case 'approval':
        return '#FF9800';
      case 'generation':
        return '#2196F3';
      case 'completed':
        return '#4CAF50';
      default:
        return '#666';
    }
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 560, width: '100%' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: 28, color: '#e0e0e0', marginBottom: 16 }}>
            The Pitch Meeting
          </h1>
          <p style={{ fontSize: 14, color: '#7a7a92', lineHeight: 1.6 }}>
            Pitch your startup to a startup incubator.
            <br />
            Get challenged. Get refined. Get generated.
          </p>
        </div>

        {/* New Session Form */}
        <div
          style={{
            border: '1px solid #2a2a5a',
            borderRadius: 12,
            padding: 32,
            background: '#0f0f25',
            marginBottom: 24,
          }}
        >
          <h2 style={{ fontSize: 18, margin: '0 0 24px 0', color: '#e0e0e0' }}>
            Start New Pitch
          </h2>

          <div style={{ display: 'grid', gap: 20 }}>
            <label style={labelStyle}>
              <span>Startup Name</span>
              <input
                type="text"
                value={startupName}
                onChange={(e) => setStartupName(e.target.value)}
                placeholder="e.g., AgentFlow, PitchPal, VibeCheck..."
                style={inputStyle}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleStart();
                }}
              />
            </label>

            <label style={labelStyle}>
              <span>AI Provider</span>
              <select
                value={provider}
                onChange={(e) => {
                  const value = e.target.value;
                  if (isProviderValue(value)) {
                    setProvider(value);
                  }
                }}
                style={inputStyle}
                disabled={loading}
              >
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              <span>Model</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                style={inputStyle}
                disabled={loading || loadingModels || modelOptions.length === 0}
              >
                {loadingModels && <option value="">Loading models...</option>}
                {!loadingModels && modelOptions.length === 0 && (
                  <option value="">No models available</option>
                )}
                {!loadingModels
                  && modelOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.displayName}
                    </option>
                  ))}
              </select>
            </label>

            {modelWarning && (
              <div
                style={{
                  fontSize: 11,
                  color: '#ffd29a',
                  background: '#2f2414',
                  border: '1px solid #614522',
                  padding: 10,
                  borderRadius: 6,
                }}
              >
                {modelWarning}
              </div>
            )}

            {error && (
              <div
                style={{
                  fontSize: 12,
                  color: '#ff8f8f',
                  background: '#301010',
                  border: '1px solid #5f2b2b',
                  padding: 12,
                  borderRadius: 6,
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={loading || loadingModels || !model}
              style={buttonStyle}
            >
              {loading ? 'Starting...' : 'Enter the Pitch Room'}
            </button>
          </div>
        </div>

        {/* Recent Sessions */}
        {!loadingSessions && recentSessions.length > 0 && (
          <div
            style={{
              border: '1px solid #2a2a5a',
              borderRadius: 12,
              padding: 32,
              background: '#0f0f25',
            }}
          >
            <h2 style={{ fontSize: 18, margin: '0 0 20px 0', color: '#e0e0e0' }}>
              Recent Sessions
            </h2>

            <div style={{ display: 'grid', gap: 12 }}>
              {recentSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleResume(session.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 20px',
                    background: '#1a1a3a',
                    border: '1px solid #2a2a5a',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, color: '#e0e0e0', marginBottom: 4 }}>
                      {session.startup_name || 'Unnamed Startup'}
                    </div>
                    <div style={{ fontSize: 11, color: '#7a7a92' }}>
                      {new Date(session.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '6px 12px',
                      background: `${getStatusColor(session.status)}22`,
                      color: getStatusColor(session.status),
                      borderRadius: 4,
                    }}
                  >
                    {getStatusLabel(session.status, session.current_round)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            textAlign: 'center',
            marginTop: 40,
            fontSize: 11,
            color: '#4a4a6a',
          }}
        >
          4-6 rounds of tough questions, then your AI team gets generated.
        </div>
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  fontSize: 13,
  color: '#a0a0b5',
};

const inputStyle: CSSProperties = {
  fontSize: 14,
  padding: '16px 18px',
  background: '#111129',
  border: '1px solid #2a2a5a',
  borderRadius: 6,
  color: '#f0f0f5',
  fontFamily: 'inherit',
  outline: 'none',
};

const buttonStyle: CSSProperties = {
  fontSize: 14,
  padding: '18px 24px',
  background: '#7c5cff',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'inherit',
  marginTop: 12,
};
