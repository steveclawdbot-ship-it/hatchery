export type PitchSessionStatus =
  | 'in_progress'
  | 'synthesis'
  | 'approval'
  | 'generation'
  | 'completed';

export const PITCH_SESSION_STATUSES: PitchSessionStatus[] = [
  'in_progress',
  'synthesis',
  'approval',
  'generation',
  'completed',
];

const ALLOWED_TRANSITIONS: Record<PitchSessionStatus, PitchSessionStatus[]> = {
  in_progress: ['synthesis'],
  synthesis: ['approval'],
  approval: ['generation', 'synthesis'],
  generation: ['completed'],
  completed: [],
};

export function canTransitionPitchStatus(
  current: PitchSessionStatus,
  next: PitchSessionStatus,
): boolean {
  if (current === next) return true;
  return ALLOWED_TRANSITIONS[current].includes(next);
}

export function isPitchSessionStatus(value: unknown): value is PitchSessionStatus {
  return typeof value === 'string' && PITCH_SESSION_STATUSES.includes(value as PitchSessionStatus);
}

export function getRoundCompletionStatus(
  currentRound: number,
  totalRounds: number,
): PitchSessionStatus {
  return currentRound + 1 > totalRounds ? 'synthesis' : 'in_progress';
}
