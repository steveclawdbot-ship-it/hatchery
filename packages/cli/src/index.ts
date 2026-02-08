/**
 * Hatchery — Programmatic API
 *
 * Usage:
 *   import { createStartup } from 'hatchery';
 *   const result = await createStartup({
 *     name: 'my-startup',
 *     pitch: 'An AI-powered...',
 *     provider: 'anthropic',
 *     apiKey: process.env.ANTHROPIC_API_KEY,
 *   });
 */

import { createProvider, ProviderName } from './llm/provider.js';
import { runWizard, WizardResult } from './wizard/index.js';
import { scaffoldProject } from './scaffolder/index.js';

export interface CreateStartupOptions {
  name: string;
  pitch: string;
  provider: ProviderName;
  apiKey: string;
  outputDir?: string;
  skipMeeting?: boolean;
}

export interface CreateStartupResult {
  projectDir: string;
  strategy: string;
  agents: WizardResult['agentConfig'];
  stepKinds: WizardResult['workerConfig']['stepKinds'];
  configs: WizardResult['configs'];
  revisedPitch: string;
}

export async function createStartup(options: CreateStartupOptions): Promise<CreateStartupResult> {
  const llm = await createProvider(options.provider, options.apiKey);

  const result = await runWizard(llm, options.name, {
    initialPitch: options.pitch,
    skipMeeting: options.skipMeeting ?? true,
  });

  const projectDir = scaffoldProject(result, {
    name: options.name,
    outputDir: options.outputDir ?? '.',
    provider: options.provider,
  });

  return {
    projectDir,
    strategy: result.strategy,
    agents: result.agentConfig,
    stepKinds: result.workerConfig.stepKinds,
    configs: result.configs,
    revisedPitch: result.revisedPitch.raw,
  };
}

// Re-exports for advanced usage
export { createProvider, type ProviderName, type LLMProvider } from './llm/provider.js';
export { tierForTask, estimateCost } from './llm/tiering.js';
export type { WizardResult } from './wizard/index.js';
export type { AgentConfig } from './wizard/agent-generator.js';
export type { WorkerConfig } from './wizard/worker-generator.js';
