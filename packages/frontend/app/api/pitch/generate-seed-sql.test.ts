import { describe, expect, it } from 'vitest';
import { generateSeedSql } from '../../../lib/pitch/seed-sql';
import type { AgentConfig, WorkerConfig } from '../../../lib/pitch/types';

const agentConfig: AgentConfig = {
  agents: [
    {
      id: 'analyst',
      displayName: 'Analyst',
      role: 'Research',
      tone: 'direct',
      systemDirective: 'Find evidence.',
      quirk: 'Uses tables',
      canInitiate: true,
      cooldownHours: 4,
    },
    {
      id: 'operator',
      displayName: 'Operator',
      role: 'Execution',
      tone: 'focused',
      systemDirective: 'Execute quickly.',
      quirk: 'Prefers checklists',
      canInitiate: false,
      cooldownHours: 4,
    },
    {
      id: 'writer',
      displayName: 'Writer',
      role: 'Content',
      tone: 'clear',
      systemDirective: 'Write concise copy.',
      quirk: 'Avoids fluff',
      canInitiate: true,
      cooldownHours: 4,
    },
  ],
  initialAffinities: [
    { agentA: 'analyst', agentB: 'operator', affinity: 0.62, reason: 'Complementary roles' },
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
      name: 'heartbeat_trigger',
      eventPattern: 'system.heartbeat',
      proposalTemplate: {
        title: 'Auto research',
        steps: [{ kind: 'research', description: 'Run a research pass' }],
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

describe('frontend generateSeedSql', () => {
  it('includes step description in ops_step_registry insert', () => {
    const sql = generateSeedSql('TestCo', agentConfig, workerConfig);
    expect(sql).toContain('ops_step_registry');
    expect(sql).toContain('description');
    expect(sql).toContain('Collects market evidence');
  });
});
