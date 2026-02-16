'use client';

import { type CSSProperties, useEffect, useState } from 'react';
import OperationsSummary from '@/components/dashboard/operations-summary';

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
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

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
    ? 'var(--hatch-success)'
    : control.mode === 'paused'
      ? 'var(--hatch-warning)'
      : 'var(--hatch-danger)';

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 960, animation: 'slideUp 0.4s ease-out' }}>
      <section className="glass-card" style={{ padding: 16 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}>
          <h2 style={{
            fontSize: 13,
            fontFamily: 'var(--hatch-font-display)',
            color: 'var(--hatch-text-primary)',
            margin: 0,
          }}>
            CONTROL PANEL
          </h2>
          <span style={{
            fontSize: 10,
            fontFamily: 'var(--hatch-font-display)',
            color: modeColor,
            background: `color-mix(in srgb, ${modeColor} 15%, transparent)`,
            padding: '4px 10px',
            borderRadius: 4,
            animation: control.mode === 'running' ? 'liveIndicator 2s ease-in-out infinite' : undefined,
            textShadow: `0 0 8px ${modeColor}`,
          }}>
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
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--hatch-accent-primary)';
                e.currentTarget.style.boxShadow = '0 0 8px rgba(124, 92, 255, 0.3)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--hatch-border-default)';
                e.currentTarget.style.boxShadow = 'none';
              }}
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
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--hatch-accent-primary)';
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(124, 92, 255, 0.3)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--hatch-border-default)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
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
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--hatch-accent-primary)';
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(124, 92, 255, 0.3)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--hatch-border-default)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
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
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--hatch-accent-primary)';
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(124, 92, 255, 0.3)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--hatch-border-default)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
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
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--hatch-accent-primary)';
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(124, 92, 255, 0.3)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--hatch-border-default)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
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
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--hatch-accent-primary)';
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(124, 92, 255, 0.3)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--hatch-border-default)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </label>
          </div>

          <button
            onClick={saveConfig}
            disabled={loading || saving}
            onMouseEnter={() => setHoveredBtn('save')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              ...buttonStyle,
              background: hoveredBtn === 'save' ? 'var(--hatch-bg-elevated)' : 'var(--hatch-bg-surface)',
              color: 'var(--hatch-accent-primary)',
              width: 200,
              fontFamily: 'var(--hatch-font-display)',
              fontSize: 10,
              boxShadow: hoveredBtn === 'save' ? 'var(--hatch-glow-primary)' : 'none',
              transition: 'all 150ms ease',
            }}
          >
            {saving ? 'SAVING...' : 'SAVE CONFIG'}
          </button>
        </div>
      </section>

      <section className="glass-card" style={{ padding: 16 }}>
        <h3 style={{
          fontSize: 11,
          fontFamily: 'var(--hatch-font-display)',
          color: 'var(--hatch-text-primary)',
          margin: '0 0 14px 0',
        }}>
          EXECUTION CONTROLS
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <ControlButton
            label="Run Now"
            busy={actionBusy === 'run_now'}
            onClick={() => triggerAction('run_now')}
            hovered={hoveredBtn === 'run_now'}
            onHover={(h) => setHoveredBtn(h ? 'run_now' : null)}
          />
          <ControlButton
            label="Pause"
            busy={actionBusy === 'pause'}
            onClick={() => triggerAction('pause')}
            hovered={hoveredBtn === 'pause'}
            onHover={(h) => setHoveredBtn(h ? 'pause' : null)}
          />
          <ControlButton
            label="Resume"
            busy={actionBusy === 'resume'}
            onClick={() => triggerAction('resume')}
            hovered={hoveredBtn === 'resume'}
            onHover={(h) => setHoveredBtn(h ? 'resume' : null)}
          />
          <ControlButton
            label="Stop All"
            busy={actionBusy === 'stop_all'}
            danger
            onClick={() => triggerAction('stop_all')}
            hovered={hoveredBtn === 'stop_all'}
            onHover={(h) => setHoveredBtn(h ? 'stop_all' : null)}
          />
        </div>

        <div style={{
          marginTop: 12,
          fontSize: 11,
          fontFamily: 'var(--hatch-font-body)',
          color: 'var(--hatch-text-muted)',
        }}>
          Polling cadence: every {control.pollingMinutes} minutes.
          {' '}
          {control.updatedAt ? `Last mode update: ${new Date(control.updatedAt).toLocaleString()}.` : ''}
        </div>
      </section>

      <OperationsSummary />

      {message && (
        <div style={{
          border: '1px solid #2b5f44',
          background: '#103020',
          padding: '10px 14px',
          fontSize: 11,
          fontFamily: 'var(--hatch-font-body)',
          color: 'var(--hatch-success)',
          borderRadius: 6,
          animation: 'fadeIn 0.3s ease-out',
        }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{
          border: '1px solid #5f2b2b',
          background: '#301010',
          padding: '10px 14px',
          fontSize: 11,
          fontFamily: 'var(--hatch-font-body)',
          color: '#ff8f8f',
          borderRadius: 6,
          animation: 'fadeIn 0.3s ease-out',
        }}>
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
    hovered,
    onHover,
  }: {
    label: string;
    busy: boolean;
    danger?: boolean;
    onClick: () => void;
    hovered: boolean;
    onHover: (h: boolean) => void;
  },
) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{
        ...buttonStyle,
        fontFamily: 'var(--hatch-font-body)',
        background: danger
          ? (hovered ? '#5a2020' : '#3a1515')
          : (hovered ? 'var(--hatch-bg-elevated)' : 'var(--hatch-bg-surface)'),
        color: danger ? '#ff8f8f' : 'var(--hatch-accent-secondary)',
        boxShadow: hovered
          ? danger
            ? '0 0 12px rgba(244, 67, 54, 0.2)'
            : 'var(--hatch-glow-primary)'
          : 'none',
        transition: 'all 150ms ease',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        animation: danger && hovered ? 'dangerPulse 2s ease-in-out infinite' : undefined,
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
  fontFamily: 'var(--hatch-font-body)',
  color: 'var(--hatch-text-muted)',
};

const inputStyle: CSSProperties = {
  fontSize: 13,
  fontFamily: 'var(--hatch-font-body)',
  padding: '8px 10px',
  background: 'var(--hatch-bg-deep)',
  border: '1px solid var(--hatch-border-default)',
  borderRadius: 6,
  color: 'var(--hatch-text-primary)',
  outline: 'none',
  transition: 'border-color 150ms ease, box-shadow 150ms ease',
};

const buttonStyle: CSSProperties = {
  border: '1px solid var(--hatch-border-default)',
  borderRadius: 6,
  fontSize: 12,
  padding: '10px 16px',
  cursor: 'pointer',
};
