import type { PitchSession } from './types';

export interface LaunchReadinessCheck {
  id: string;
  label: string;
  ready: boolean;
}

export interface LaunchReadiness {
  ready: boolean;
  checks: LaunchReadinessCheck[];
}

export interface ActivationRpcResult {
  success: boolean;
  code: string;
  message: string;
  sessionId: string | null;
  missionId: string | null;
  replacedExisting: boolean;
  activatedAt: string | null;
}

export function getLaunchReadiness(session: PitchSession): LaunchReadiness {
  const checks: LaunchReadinessCheck[] = [
    {
      id: 'pitch-approved',
      label: 'Revised pitch approved',
      ready: Boolean(session.revised_pitch && session.revised_pitch_approved),
    },
    {
      id: 'agent-config',
      label: 'Agent configuration generated',
      ready: Boolean(session.agent_config?.agents?.length),
    },
    {
      id: 'worker-config',
      label: 'Worker configuration generated',
      ready: Boolean(session.worker_config?.stepKinds?.length),
    },
    {
      id: 'strategy',
      label: 'Strategy document generated',
      ready: typeof session.strategy === 'string' && session.strategy.trim().length > 0,
    },
  ];

  return {
    ready: checks.every((check) => check.ready),
    checks,
  };
}

export function parseActivationRpcResult(value: unknown): ActivationRpcResult | null {
  if (!isRecord(value)) return null;

  const success = value.success === true;
  const code = typeof value.code === 'string' ? value.code : success ? 'activated' : 'unknown_error';
  const message = typeof value.message === 'string'
    ? value.message
    : success
      ? 'Startup activated successfully.'
      : 'Activation failed.';
  const sessionId = asStringOrNull(value.sessionId);
  const missionId = asStringOrNull(value.missionId);
  const replacedExisting = value.replacedExisting === true;
  const activatedAt = asStringOrNull(value.activatedAt);

  return {
    success,
    code,
    message,
    sessionId,
    missionId,
    replacedExisting,
    activatedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
