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

const METRIC_PATTERN = /\b\d+(?:\.\d+)?\s?(?:%|x|k|m|days?|weeks?|hours?|mins?|minutes?|seconds?|users?|leads?|customers?|tickets?|usd|\$)\b/i;
const LOW_INFORMATION_PATTERN = /\b(idk|i\s*don'?t\s*know|not sure|maybe|whatever|something like that|etc)\b/i;

const PERSONA_PATTERN = /\b(user|customer|persona|audience|buyer|team|marketer|founder|operator|sales)\b/i;
const TRIGGER_PATTERN = /\b(trigger|when|after|event|signal|pain|problem|happens)\b/i;
const OUTCOME_PATTERN = /\b(outcome|goal|result|improve|increase|reduce|save|conversion|retention|revenue)\b/i;

const BASELINE_PATTERN = /\b(today|currently|right now|manual|spreadsheet|existing|status quo|competitor|alternative)\b/i;
const EVIDENCE_PATTERN = /\b(metric|data|evidence|rate|time|cost|quality|error|benchmark)\b/i;
const SWITCH_PATTERN = /\b(switch|replace|adopt|why now|choose|better)\b/i;

const GOAL_PATTERN = /\b(goal|target|kpi|metric|objective)\b/i;
const MISSION_PATTERN = /\b(mission|milestone|deliverable|roadmap)\b/i;
const OWNER_DEADLINE_PATTERN = /\b(owner|responsible|deadline|date|week|month|by\s+\w+)\b/i;

const TEAM_PATTERN = /\b(agent|role|team|planner|analyst|writer|operator)\b/i;
const HANDOFF_PATTERN = /\b(handoff|handover|handoffs|escalat|fallback|review|approval)\b/i;
const FAILURE_PATTERN = /\b(fail|failure|blocked|retry|recover|incident)\b/i;

const TASK_PATTERN = /\b(task|backlog|todo|step|workflow|ticket)\b/i;
const DEPENDENCY_PATTERN = /\b(depend|dependency|after|before|sequence|trigger)\b/i;
const ACCEPTANCE_PATTERN = /\b(done when|acceptance|criteria|test|verify|definition of done)\b/i;

const PLAN_PATTERN = /\b(week|day|daily|schedule|cadence|plan)\b/i;
const KPI_PATTERN = /\b(kpi|metric|checkpoint|review)\b/i;
const RISK_PATTERN = /\b(risk|mitigation|owner|responsible|fallback)\b/i;

interface RoundAdvanceRule {
  minWords: number;
  minMatches: number;
  requireMetric?: boolean;
  patterns: RegExp[];
}

const ROUND_ADVANCE_RULES: Record<number, RoundAdvanceRule> = {
  1: {
    minWords: 10,
    minMatches: 2,
    patterns: [PERSONA_PATTERN, TRIGGER_PATTERN, OUTCOME_PATTERN],
  },
  2: {
    minWords: 10,
    minMatches: 2,
    requireMetric: true,
    patterns: [BASELINE_PATTERN, EVIDENCE_PATTERN, SWITCH_PATTERN],
  },
  3: {
    minWords: 10,
    minMatches: 2,
    requireMetric: true,
    patterns: [GOAL_PATTERN, MISSION_PATTERN, OWNER_DEADLINE_PATTERN],
  },
  4: {
    minWords: 10,
    minMatches: 2,
    patterns: [TEAM_PATTERN, HANDOFF_PATTERN, FAILURE_PATTERN],
  },
  5: {
    minWords: 10,
    minMatches: 2,
    patterns: [TASK_PATTERN, DEPENDENCY_PATTERN, ACCEPTANCE_PATTERN],
  },
  6: {
    minWords: 10,
    minMatches: 2,
    patterns: [PLAN_PATTERN, KPI_PATTERN, RISK_PATTERN],
  },
};

function countPatternMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => (pattern.test(text) ? count + 1 : count), 0);
}

export function shouldAdvancePitchRound(
  currentRound: number,
  founderInput: string,
): boolean {
  const normalized = founderInput.trim();
  if (!normalized) {
    return false;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const hasMetric = METRIC_PATTERN.test(normalized);

  if (wordCount < 5 && !hasMetric) {
    return false;
  }

  if (LOW_INFORMATION_PATTERN.test(normalized) && wordCount < 20 && !hasMetric) {
    return false;
  }

  const rule = ROUND_ADVANCE_RULES[currentRound];
  if (!rule) {
    return wordCount >= 10 || hasMetric;
  }

  const matchCount = countPatternMatches(normalized, rule.patterns);
  if (matchCount < rule.minMatches) {
    return false;
  }
  if (rule.requireMetric && !hasMetric) {
    return false;
  }

  return wordCount >= rule.minWords || hasMetric;
}
