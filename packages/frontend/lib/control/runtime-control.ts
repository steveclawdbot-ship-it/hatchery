export type RuntimeMode = 'running' | 'paused' | 'stopped';
export type ControlAction = 'run_now' | 'pause' | 'resume' | 'stop_all';

export function parseControlAction(value: unknown): ControlAction | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const action = (value as Record<string, unknown>).action;
  if (
    action === 'run_now' ||
    action === 'pause' ||
    action === 'resume' ||
    action === 'stop_all'
  ) {
    return action;
  }
  return null;
}

export function modeForAction(action: Exclude<ControlAction, 'run_now'>): RuntimeMode {
  if (action === 'pause') return 'paused';
  if (action === 'resume') return 'running';
  return 'stopped';
}
