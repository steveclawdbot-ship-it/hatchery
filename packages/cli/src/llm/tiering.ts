import { Tier } from './provider.js';

/**
 * Maps task types to their recommended LLM tier.
 *
 * cheap:     Simple generation, sentiment, classification
 * mid:       Persona generation, content creation, analysis synthesis
 * expensive: Strategy, architecture design, complex multi-step reasoning
 */
const TASK_TIER_MAP: Record<string, Tier> = {
  // Wizard phases
  'pitch-meeting': 'expensive',
  'revised-pitch': 'mid',
  'agent-generation': 'mid',
  'worker-generation': 'expensive',
  'strategy-generation': 'expensive',
  'config-generation': 'mid',

  // Runtime conversations
  'conversation': 'cheap',
  'conversation-distill': 'mid',
  'speaker-selection': 'cheap',

  // Memory & analysis
  'memory-extraction': 'mid',
  'sentiment-analysis': 'cheap',
  'voice-evolution': 'cheap',

  // Workers
  'draft-content': 'mid',
  'analyze-data': 'mid',
  'generate-report': 'expensive',

  // Triggers & initiatives
  'trigger-evaluation': 'cheap',
  'initiative-generation': 'mid',
};

export function tierForTask(task: string): Tier {
  return TASK_TIER_MAP[task] ?? 'mid';
}

export function estimateCost(tier: Tier, tokens: number): number {
  const rates: Record<Tier, number> = {
    cheap: 0.25 / 1_000_000,
    mid: 3.0 / 1_000_000,
    expensive: 15.0 / 1_000_000,
  };
  return tokens * rates[tier];
}
