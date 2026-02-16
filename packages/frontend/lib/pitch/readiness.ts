import type { Round } from './types';

export interface BuildReadinessAssessment {
  ready: boolean;
  score: number;
  missing: string[];
}

interface ChecklistSignals {
  persona: boolean;
  trigger: boolean;
  baseline: boolean;
  measurableOutcome: boolean;
  executionPlan: boolean;
  metricMentions: number;
}

const PERSONA_PATTERN = /\b(user|customer|persona|icp|audience|buyer|team|role|founder|operator|marketer)\b/i;
const TRIGGER_PATTERN = /\b(trigger|when|after|event|happens|incident|deadline|pain event|signal)\b/i;
const BASELINE_PATTERN = /\b(today|currently|status quo|manual|spreadsheet|existing|alternative|competitor|right now)\b/i;
const OUTCOME_PATTERN = /\b(outcome|improve|reduce|increase|target|goal|success|conversion|retention|accuracy|latency)\b/i;
const EXECUTION_PATTERN = /\b(mission|task|owner|handoff|dependency|backlog|kpi|milestone|deadline|acceptance)\b/i;
const METRIC_PATTERN = /\b\d+(?:\.\d+)?\s?(?:%|x|k|m|days?|weeks?|hours?|mins?|minutes?|seconds?|users?|leads?|customers?|tickets?|usd|\$)\b/gi;

function detectSignals(text: string): ChecklistSignals {
  const metricMentions = (text.match(METRIC_PATTERN) ?? []).length;

  return {
    persona: PERSONA_PATTERN.test(text),
    trigger: TRIGGER_PATTERN.test(text),
    baseline: BASELINE_PATTERN.test(text),
    measurableOutcome: OUTCOME_PATTERN.test(text),
    executionPlan: EXECUTION_PATTERN.test(text),
    metricMentions,
  };
}

export function assessBuildReadiness(
  rounds: Array<Pick<Round, 'founderInput' | 'vcResponse'>>
): BuildReadinessAssessment {
  const transcript = rounds
    .flatMap((round) => [round.founderInput ?? '', round.vcResponse ?? ''])
    .join('\n\n');
  const signals = detectSignals(transcript);

  const score =
    Number(signals.persona)
    + Number(signals.trigger)
    + Number(signals.baseline)
    + Number(signals.measurableOutcome)
    + Number(signals.executionPlan);

  const missing: string[] = [];
  if (rounds.length < 4) missing.push('more discovery turns');
  if (!signals.persona) missing.push('clear primary user persona');
  if (!signals.trigger) missing.push('trigger event that starts usage');
  if (!signals.baseline) missing.push('current baseline or alternative');
  if (!signals.measurableOutcome) missing.push('specific near-term outcomes');
  if (!signals.executionPlan) missing.push('execution details (owners/tasks/handoffs)');
  if (signals.metricMentions < 2) missing.push('at least two concrete metrics');

  const ready = rounds.length >= 4 && score >= 4 && signals.metricMentions >= 2;
  return { ready, score, missing };
}
