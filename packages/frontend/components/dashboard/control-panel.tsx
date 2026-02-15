'use client';

import { type CSSProperties, useEffect, useState } from 'react';

type CompanyTemplate = 'research' | 'back-office' | 'creative';
type RuntimeMode = 'running' | 'paused' | 'stopped';
type ControlAction = 'run_now' | 'pause' | 'resume' | 'stop_all';

interface CompanyConfig {
  companyTemplate: CompanyTemplate;
  metricName: string;
  targetValue: number;
  deadlineDays: number;
  budgetLimit: number;
  loopCapPerDay: number;
  postLimitPerDay: number;
}

interface ControlState {
  mode: RuntimeMode;
  updatedAt: string | null;
  pollingMinutes: number;
}

const DEFAULT_CONFIG: CompanyConfig = {
  companyTemplate: 'research',
  metricName: 'Weekly qualified leads',
  targetValue: 25,
  deadlineDays: 30,
  budgetLimit: 100,
  loopCapPerDay: 24,
  postLimitPerDay: 5,
};

const DEFAULT_CONTROL: ControlState = {
  mode: 'running',
  updatedAt: null,
  pollingMinutes: 5,
};

export default function ControlPanel() {
  const [config, setConfig] = useState<CompanyConfig>(DEFAULT_CONFIG);
  const [control, setControl] = useState<ControlState>(DEFAULT_CONTROL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<ControlAction | null>(null);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    void loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/company/config');
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load company config');
      }
      setConfig(payload.config ?? DEFAULT_CONFIG);
      setControl(payload.control ?? DEFAULT_CONTROL);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Failed to load company config';
      setError(messageText);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/company/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to save company config');
      }
      setConfig(payload.config ?? config);
      setMessage('Company config saved.');
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Failed to save company config';
      setError(messageText);
    } finally {
      setSaving(false);
    }
  }

  async function triggerAction(action: ControlAction) {
    setActionBusy(action);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to run control action');
      }
      if (payload.control) setControl(payload.control as ControlState);
      setMessage(payload.message ?? `Action completed: ${action}`);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Failed to run control action';
      setError(messageText);
    } finally {
      setActionBusy(null);
    }
  }

  const modeColor = control.mode === 'running'
    ? '#4CAF50'
    : control.mode === 'paused'
      ? '#FF9800'
      : '#F44336';

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 960 }}>
      <section style={{ border: '1px solid #2a2a5a', borderRadius: 6, padding: 16 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Control Panel</h2>
          <span style={{
            fontSize: 11,
            color: modeColor,
            background: `${modeColor}22`,
            padding: '4px 8px',
            borderRadius: 4,
          }}
          >
            {control.mode.toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <label style={labelStyle}>
            <span>Company template</span>
            <select
              value={config.companyTemplate}
              onChange={(event) => setConfig((prev) => ({
                ...prev,
                companyTemplate: event.target.value as CompanyTemplate,
              }))}
              style={inputStyle}
              disabled={loading || saving}
            >
              <option value="research">Research Company</option>
              <option value="back-office">Back Office Admin</option>
              <option value="creative">Creative Agency</option>
            </select>
          </label>

          <label style={labelStyle}>
            <span>Primary metric</span>
            <input
              type="text"
              value={config.metricName}
              onChange={(event) => setConfig((prev) => ({ ...prev, metricName: event.target.value }))}
              style={inputStyle}
              disabled={loading || saving}
              placeholder="Example: Weekly qualified leads"
            />
          </label>

          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <label style={labelStyle}>
              <span>Target value</span>
              <input
                type="number"
                min={1}
                value={config.targetValue}
                onChange={(event) => setConfig((prev) => ({ ...prev, targetValue: Number(event.target.value) }))}
                style={inputStyle}
                disabled={loading || saving}
              />
            </label>

            <label style={labelStyle}>
              <span>Deadline (days)</span>
              <input
                type="number"
                min={1}
                value={config.deadlineDays}
                onChange={(event) => setConfig((prev) => ({ ...prev, deadlineDays: Number(event.target.value) }))}
                style={inputStyle}
                disabled={loading || saving}
              />
            </label>

            <label style={labelStyle}>
              <span>Budget limit (USD)</span>
              <input
                type="number"
                min={1}
                value={config.budgetLimit}
                onChange={(event) => setConfig((prev) => ({ ...prev, budgetLimit: Number(event.target.value) }))}
                style={inputStyle}
                disabled={loading || saving}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <label style={labelStyle}>
              <span>Loop cap per day</span>
              <input
                type="number"
                min={1}
                value={config.loopCapPerDay}
                onChange={(event) => setConfig((prev) => ({ ...prev, loopCapPerDay: Number(event.target.value) }))}
                style={inputStyle}
                disabled={loading || saving}
              />
            </label>

            <label style={labelStyle}>
              <span>Post cap per day</span>
              <input
                type="number"
                min={1}
                value={config.postLimitPerDay}
                onChange={(event) => setConfig((prev) => ({ ...prev, postLimitPerDay: Number(event.target.value) }))}
                style={inputStyle}
                disabled={loading || saving}
              />
            </label>
          </div>

          <button
            onClick={saveConfig}
            disabled={loading || saving}
            style={{
              ...buttonStyle,
              background: '#2a2a5a',
              color: '#7c5cff',
              width: 180,
            }}
          >
            {saving ? 'Saving...' : 'Save Company Config'}
          </button>
        </div>
      </section>

      <section style={{ border: '1px solid #2a2a5a', borderRadius: 6, padding: 16 }}>
        <h3 style={{ fontSize: 16, margin: '0 0 12px 0' }}>Execution Controls</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <ControlButton
            label="Run Now"
            busy={actionBusy === 'run_now'}
            onClick={() => triggerAction('run_now')}
          />
          <ControlButton
            label="Pause"
            busy={actionBusy === 'pause'}
            onClick={() => triggerAction('pause')}
          />
          <ControlButton
            label="Resume"
            busy={actionBusy === 'resume'}
            onClick={() => triggerAction('resume')}
          />
          <ControlButton
            label="Stop All"
            busy={actionBusy === 'stop_all'}
            danger
            onClick={() => triggerAction('stop_all')}
          />
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: '#8a8a9a' }}>
          Polling cadence: every {control.pollingMinutes} minutes.
          {' '}
          {control.updatedAt ? `Last mode update: ${new Date(control.updatedAt).toLocaleString()}.` : ''}
        </div>
      </section>

      {message && (
        <div style={{ border: '1px solid #2b5f44', background: '#103020', padding: 10, fontSize: 11, color: '#7fe0a8', borderRadius: 6 }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ border: '1px solid #5f2b2b', background: '#301010', padding: 10, fontSize: 11, color: '#ff8f8f', borderRadius: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function ControlButton(
  {
    label,
    busy,
    danger = false,
    onClick,
  }: {
    label: string;
    busy: boolean;
    danger?: boolean;
    onClick: () => void;
  },
) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        ...buttonStyle,
        background: danger ? '#4a1f1f' : '#1a1a3a',
        color: danger ? '#ff8f8f' : '#9aa0ff',
      }}
    >
      {busy ? 'Working...' : label}
    </button>
  );
}

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  fontSize: 11,
  color: '#a0a0b5',
};

const inputStyle: CSSProperties = {
  fontSize: 14,
  padding: '8px 10px',
  background: '#111129',
  border: '1px solid #2a2a5a',
  borderRadius: 4,
  color: '#f0f0f5',
  fontFamily: 'inherit',
};

const buttonStyle: CSSProperties = {
  border: '1px solid #2a2a5a',
  borderRadius: 4,
  fontSize: 12,
  padding: '10px 16px',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
