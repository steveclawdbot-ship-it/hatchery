import { describe, expect, it } from 'vitest';
import { modeForAction, parseControlAction } from './runtime-control';

describe('runtime-control', () => {
  it('parses valid actions', () => {
    expect(parseControlAction({ action: 'run_now' })).toBe('run_now');
    expect(parseControlAction({ action: 'pause' })).toBe('pause');
    expect(parseControlAction({ action: 'resume' })).toBe('resume');
    expect(parseControlAction({ action: 'stop_all' })).toBe('stop_all');
  });

  it('rejects invalid actions', () => {
    expect(parseControlAction(null)).toBeNull();
    expect(parseControlAction('pause')).toBeNull();
    expect(parseControlAction({ action: 'delete_everything' })).toBeNull();
  });

  it('maps action to expected runtime mode', () => {
    expect(modeForAction('pause')).toBe('paused');
    expect(modeForAction('resume')).toBe('running');
    expect(modeForAction('stop_all')).toBe('stopped');
  });
});
