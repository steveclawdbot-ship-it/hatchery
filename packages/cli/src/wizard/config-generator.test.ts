import { describe, expect, it } from 'vitest';
import { generateSeedSQL } from './config-generator';
import type { AgentConfig } from './agent-generator';
import type { WorkerConfig } from './worker-generator';

const agentConfig: AgentConfig = {
  agents: [
    {
      id: 'analyst',
      displayName: 'Analyst',
      role: 'Research',
      tone: 'direct',
      systemDirective: 'Find data-backed insights.',
      quirk: 'Uses bullet lists',
      canInitiate: true,
      cooldownHours: 4,
    },
    {
      id: 'operator',
      displayName: 'Operator',
      role: 'Execution',
      tone: 'focused',
      systemDirective: 'Execute and report.',
      quirk: 'Always summarizes outcomes',
      canInitiate: false,
      cooldownHours: 4,
    },
    {
      id: 'writer',
      displayName: 'Writer',
      role: 'Content',
      tone: 'clear',
      systemDirective: 'Write concise copy.',
      quirk: 'Keeps it short',
      canInitiate: true,
      cooldownHours: 4,
    },
  ],
  initialAffinities: [
    { agentA: 'analyst', agentB: 'operator', affinity: 0.6, reason: 'Shared goals' },
  ],
  conversationFormats: ['standup'],
  dailySchedule: [{ hour: 9, format: 'standup', probability: 1, participants: 'all' }],
};

const workerConfig: WorkerConfig = {
  stepKinds: [
    {
      kind: 'research',
      displayName: 'Research',
      workerType: 'analyst',
      description: 'Collects market evidence',
      requiredConfig: [],
      capGatePolicyKey: 'research_daily',
    },
  ],
  triggers: [
    {
      name: 'on_event',
      eventPattern: 'system.heartbeat',
      proposalTemplate: {
        title: 'Auto',
        steps: [{ kind: 'research', description: 'Do research' }],
      },
      cooldownMinutes: 60,
      isActive: true,
    },
  ],
  policies: {
    auto_approve: { enabled: true, allowed_step_kinds: ['research'] },
    daily_quotas: {},
    memory_influence: { enabled: true, probability: 0.3 },
  },
  capGates: {
    research_daily: { limit: 10, period: 'daily' },
  },
};

describe('generateSeedSQL', () => {
  it('includes step description in ops_step_registry insert', () => {
    const sql = generateSeedSQL('TestCo', agentConfig, workerConfig);
    expect(sql).toContain('ops_step_registry');
    expect(sql).toContain('description');
    expect(sql).toContain('Collects market evidence');
  });

  it('escapes single quotes in generated SQL values', () => {
    const configWithQuotes: WorkerConfig = {
      ...workerConfig,
      stepKinds: [
        {
          kind: "it's_a_test",
          displayName: "It's a Test",
          workerType: 'analyst',
          description: "Agent's market analysis",
          requiredConfig: [],
          capGatePolicyKey: 'research_daily',
        },
      ],
    };
    const sql = generateSeedSQL('TestCo', agentConfig, configWithQuotes);
    expect(sql).toContain("it''s_a_test");
    expect(sql).toContain("It''s a Test");
    expect(sql).toContain("Agent''s market analysis");
    expect(sql).not.toContain("it's_a_test");
    expect(sql).not.toContain("It's a Test");
    expect(sql).not.toContain("Agent's market analysis");
  });
});
