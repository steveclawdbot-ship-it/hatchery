/**
 * Relationship drift calculation.
 * After each conversation, affinity shifts +/-0.03 based on interaction quality.
 */

export interface DriftResult {
  agentA: string;
  agentB: string;
  drift: number;
  reason: string;
}

export function calculateDrift(
  pairwiseDrift: Array<{
    agent_a: string;
    agent_b: string;
    drift: number;
    reason: string;
  }>,
): DriftResult[] {
  return pairwiseDrift.map((d) => ({
    agentA: d.agent_a,
    agentB: d.agent_b,
    drift: clampDrift(d.drift),
    reason: d.reason,
  }));
}

function clampDrift(drift: number): number {
  // Max drift per conversation is +/-0.03
  return Math.max(-0.03, Math.min(0.03, drift));
}
