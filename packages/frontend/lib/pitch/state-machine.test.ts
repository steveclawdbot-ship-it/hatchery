import { describe, expect, it } from 'vitest';
import {
  canTransitionPitchStatus,
  getRoundCompletionStatus,
  shouldAdvancePitchRound,
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

  it('keeps the round when founder response is too vague', () => {
    expect(shouldAdvancePitchRound(1, 'Still thinking, not sure yet.')).toBe(false);
  });

  it('advances round 1 when response includes persona, trigger, and outcome detail', () => {
    expect(
      shouldAdvancePitchRound(
        1,
        'Our first user is a solo marketer. They use it when lead volume spikes, and we need to cut response time by 40% this week.',
      ),
    ).toBe(true);
  });

  it('requires concrete metrics before advancing round 2', () => {
    expect(
      shouldAdvancePitchRound(
        2,
        'Today teams use spreadsheets and manual outreach. They would switch because this flow is better.',
      ),
    ).toBe(false);
  });

  it('advances round 2 when baseline, evidence, and metric are present', () => {
    expect(
      shouldAdvancePitchRound(
        2,
        'Currently SDRs use spreadsheets and manual sourcing, which takes 6 hours per day. We can cut that to 2 hours, so they will switch.',
      ),
    ).toBe(true);
  });
});
