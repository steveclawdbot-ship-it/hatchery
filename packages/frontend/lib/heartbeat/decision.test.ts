import { describe, expect, it } from 'vitest';
import {
  getSkipReason,
  hasReachedBudgetCap,
  hasReachedLoopCap,
} from './decision';

describe('heartbeat decisions', () => {
  it('detects loop cap', () => {
    expect(hasReachedLoopCap(24, 24)).toBe(true);
    expect(hasReachedLoopCap(23, 24)).toBe(false);
  });

  it('detects budget cap', () => {
    expect(hasReachedBudgetCap(100, 100)).toBe(true);
    expect(hasReachedBudgetCap(99.99, 100)).toBe(false);
  });

  it('returns no_pending_steps skip reason', () => {
    expect(
      getSkipReason({
        loopCapReached: false,
        budgetCapReached: false,
        pendingStepCount: 0,
      }),
    ).toBe('no_pending_steps');
  });
});
