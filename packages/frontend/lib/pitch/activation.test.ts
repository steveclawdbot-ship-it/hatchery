import { describe, expect, it } from 'vitest';
import { getLaunchReadiness, parseActivationRpcResult } from './activation';
import type { PitchSession } from './types';

function buildSession(overrides: Partial<PitchSession> = {}): PitchSession {
  return {
    id: 'session-1',
    startup_name: 'Acme AI',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    status: 'completed',
    current_round: 4,
    rounds: [],
    revised_pitch: 'Strong revised pitch',
    revised_pitch_approved: true,
    agent_config: {
      agents: [
        {
          id: 'ceo',
          displayName: 'CEO Bot',
          role: 'CEO',
          tone: 'Direct',
          systemDirective: 'Lead execution',
          quirk: 'Uses checklists',
          canInitiate: true,
          cooldownHours: 4,
        },
      ],
      initialAffinities: [],
      conversationFormats: ['standup'],
      dailySchedule: [],
    },
    worker_config: {
      stepKinds: [
        {
          kind: 'research',
          displayName: 'Research',
          workerType: 'research',
          description: 'Research target market',
          requiredConfig: [],
        },
      ],
      triggers: [],
      policies: {
        auto_approve: { enabled: true, allowed_step_kinds: ['research'] },
        daily_quotas: {},
        memory_influence: { enabled: true, probability: 0.3 },
      },
      capGates: {},
    },
    strategy: '# Strategy',
    configs: {},
    activated_at: null,
    activation_mission_id: null,
    created_at: '2026-02-15T00:00:00.000Z',
    updated_at: '2026-02-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('pitch activation helpers', () => {
  it('reports ready when all launch checks pass', () => {
    const readiness = getLaunchReadiness(buildSession());
    expect(readiness.ready).toBe(true);
    expect(readiness.checks.every((check) => check.ready)).toBe(true);
  });

  it('reports blocked readiness when required fields are missing', () => {
    const readiness = getLaunchReadiness(buildSession({
      revised_pitch_approved: false,
      worker_config: {
        stepKinds: [],
        triggers: [],
        policies: {
          auto_approve: { enabled: false, allowed_step_kinds: [] },
          daily_quotas: {},
          memory_influence: { enabled: false, probability: 0.0 },
        },
        capGates: {},
      },
    }));

    expect(readiness.ready).toBe(false);
    expect(readiness.checks.some((check) => !check.ready)).toBe(true);
  });

  it('parses activation RPC payload shape', () => {
    const parsed = parseActivationRpcResult({
      success: true,
      code: 'activated',
      message: 'Startup activated successfully.',
      sessionId: 'session-1',
      missionId: 'mission-1',
      replacedExisting: true,
      activatedAt: '2026-02-15T10:00:00.000Z',
    });

    expect(parsed).toEqual({
      success: true,
      code: 'activated',
      message: 'Startup activated successfully.',
      sessionId: 'session-1',
      missionId: 'mission-1',
      replacedExisting: true,
      activatedAt: '2026-02-15T10:00:00.000Z',
    });
  });
});
