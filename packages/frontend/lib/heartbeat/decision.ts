export type HeartbeatSkipReason =
  | 'loop_cap_reached'
  | 'budget_cap_reached'
  | 'no_pending_steps';

export function hasReachedLoopCap(successRunsToday: number, loopCapPerDay: number): boolean {
  return successRunsToday >= loopCapPerDay;
}

export function hasReachedBudgetCap(estimatedSpendUsd: number, budgetLimitUsd: number): boolean {
  return estimatedSpendUsd >= budgetLimitUsd;
}

export function getSkipReason(params: {
  loopCapReached: boolean;
  budgetCapReached: boolean;
  pendingStepCount: number;
}): HeartbeatSkipReason | null {
  if (params.loopCapReached) return 'loop_cap_reached';
  if (params.budgetCapReached) return 'budget_cap_reached';
  if (params.pendingStepCount === 0) return 'no_pending_steps';
  return null;
}
