import { z } from 'zod';
import chalk from 'chalk';
import { LLMProvider } from '../llm/provider.js';
import { AGENT_GENERATION_PROMPT } from './prompts/generation.js';
import { RevisedPitch } from './revised-pitch.js';

const AgentSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: z.string(),
  tone: z.string(),
  systemDirective: z.string(),
  quirk: z.string(),
  canInitiate: z.boolean(),
  cooldownHours: z.number(),
});

const AffinitySchema = z.object({
  agentA: z.string(),
  agentB: z.string(),
  affinity: z.number().min(0.1).max(0.95),
  reason: z.string(),
});

const ScheduleEntrySchema = z.object({
  hour: z.number().min(0).max(23),
  format: z.string(),
  probability: z.number().min(0).max(1),
  participants: z.string(),
});

const AgentConfigSchema = z.object({
  agents: z.array(AgentSchema).min(3).max(6),
  initialAffinities: z.array(AffinitySchema),
  conversationFormats: z.array(z.string()),
  dailySchedule: z.array(ScheduleEntrySchema),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export async function generateAgentTeam(
  llm: LLMProvider,
  revisedPitch: RevisedPitch,
): Promise<AgentConfig> {
  console.log(chalk.dim('  Step 1/4: Generating agent team...'));

  const config = await llm.generateJSON(
    `${AGENT_GENERATION_PROMPT}\n\n--- REVISED PITCH ---\n${revisedPitch.raw}`,
    AgentConfigSchema,
    {
      tier: 'mid',
      temperature: 0.7,
    },
  );

  console.log(chalk.green(`  ✓ Generated ${config.agents.length} agents:`));
  for (const agent of config.agents) {
    const initIcon = agent.canInitiate ? '⚡' : '  ';
    console.log(chalk.white(`    ${initIcon} ${agent.displayName} (${agent.id}) — ${agent.role}`));
  }
  console.log(chalk.dim(`    ${config.initialAffinities.length} relationships defined`));
  console.log('');

  return config;
}
