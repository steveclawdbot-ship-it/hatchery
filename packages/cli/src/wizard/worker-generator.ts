import { z } from 'zod';
import chalk from 'chalk';
import { LLMProvider } from '../llm/provider.js';
import { WORKER_GENERATION_PROMPT } from './prompts/generation.js';
import { RevisedPitch } from './revised-pitch.js';
import { AgentConfig } from './agent-generator.js';

const StepKindSchema = z.object({
  kind: z.string(),
  displayName: z.string(),
  workerType: z.string(),
  description: z.string(),
  requiredConfig: z.array(z.string()),
  capGatePolicyKey: z.string().optional(),
});

const TriggerSchema = z.object({
  name: z.string(),
  eventPattern: z.string(),
  condition: z.record(z.unknown()).optional(),
  proposalTemplate: z.object({
    title: z.string(),
    steps: z.array(z.object({
      kind: z.string(),
      description: z.string(),
    })),
  }),
  cooldownMinutes: z.number(),
  isActive: z.boolean(),
});

const PoliciesSchema = z.object({
  auto_approve: z.object({
    enabled: z.boolean(),
    allowed_step_kinds: z.array(z.string()),
  }),
  daily_quotas: z.record(z.unknown()),
  memory_influence: z.object({
    enabled: z.boolean(),
    probability: z.number(),
  }),
});

const WorkerConfigSchema = z.object({
  stepKinds: z.array(StepKindSchema),
  triggers: z.array(TriggerSchema),
  policies: PoliciesSchema,
  capGates: z.record(z.object({
    limit: z.number(),
    period: z.string(),
  })),
});

export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;

export async function generateWorkerConfig(
  llm: LLMProvider,
  revisedPitch: RevisedPitch,
  agentConfig: AgentConfig,
): Promise<WorkerConfig> {
  console.log(chalk.dim('  Step 2/4: Generating work modules...'));

  const agentSummary = agentConfig.agents
    .map((a) => `- ${a.displayName} (${a.id}): ${a.role}`)
    .join('\n');

  const config = await llm.generateJSON(
    `${WORKER_GENERATION_PROMPT}\n\n--- REVISED PITCH ---\n${revisedPitch.raw}\n\n--- AGENT TEAM ---\n${agentSummary}`,
    WorkerConfigSchema,
    {
      tier: 'expensive',
      temperature: 0.6,
    },
  );

  console.log(chalk.green(`  ✓ Generated ${config.stepKinds.length} step kinds:`));
  for (const sk of config.stepKinds) {
    console.log(chalk.white(`    • ${sk.displayName} (${sk.kind}) → ${sk.workerType}`));
  }
  console.log(chalk.dim(`    ${config.triggers.length} triggers, ${Object.keys(config.capGates).length} cap gates`));
  console.log('');

  return config;
}
