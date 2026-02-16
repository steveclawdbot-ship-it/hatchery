import { describe, expect, it } from 'vitest';
import {
  canTransitionPitchStatus,
  getRoundCompletionStatus,
} from './state-machine';

describe('pitch state machine', () => {
  it('allows valid transitions', () => {
    expect(canTransitionPitchStatus('in_progress', 'synthesis')).toBe(true);
    expect(canTransitionPitchStatus('synthesis', 'approval')).toBe(true);
    expect(canTransitionPitchStatus('approval', 'generation')).toBe(true);
    expect(canTransitionPitchStatus('approval', 'synthesis')).toBe(true);
    expect(canTransitionPitchStatus('generation', 'completed')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransitionPitchStatus('in_progress', 'generation')).toBe(false);
    expect(canTransitionPitchStatus('synthesis', 'completed')).toBe(false);
    expect(canTransitionPitchStatus('completed', 'in_progress')).toBe(false);
  });

  it('returns synthesis on final round completion', () => {
    expect(getRoundCompletionStatus(6, 6)).toBe('synthesis');
  });

  it('returns in_progress before final round', () => {
    expect(getRoundCompletionStatus(3, 6)).toBe('in_progress');
  });
});
