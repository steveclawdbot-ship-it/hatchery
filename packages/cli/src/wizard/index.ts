import chalk from 'chalk';
import ora from 'ora';
import { LLMProvider } from '../llm/provider.js';
import { runPitchMeeting, PitchTranscript } from './pitch-meeting.js';
import { synthesizeRevisedPitch, RevisedPitch } from './revised-pitch.js';
import { generateAgentTeam, AgentConfig } from './agent-generator.js';
import { generateWorkerConfig, WorkerConfig } from './worker-generator.js';
import { generateStrategy } from './strategy-generator.js';
import { generateConfigs, GeneratedConfigs } from './config-generator.js';

export interface WizardResult {
  transcript: PitchTranscript;
  revisedPitch: RevisedPitch;
  agentConfig: AgentConfig;
  workerConfig: WorkerConfig;
  strategy: string;
  configs: GeneratedConfigs;
}

export async function runWizard(
  llm: LLMProvider,
  startupName: string,
  options: {
    initialPitch?: string;
    skipMeeting?: boolean;
  } = {},
): Promise<WizardResult> {
  console.log('');
  console.log(chalk.bold.magenta('  ╦ ╦╔═╗╔╦╗╔═╗╦ ╦╔═╗╦═╗╦ ╦'));
  console.log(chalk.bold.magenta('  ╠═╣╠═╣ ║ ║  ╠═╣║╣ ╠╦╝╚╦╝'));
  console.log(chalk.bold.magenta('  ╩ ╩╩ ╩ ╩ ╚═╝╩ ╩╚═╝╩╚═ ╩ '));
  console.log(chalk.dim(`  Creating: ${startupName}`));
  console.log('');

  // Phase A: The Pitch Meeting
  let transcript: PitchTranscript;
  if (options.skipMeeting && options.initialPitch) {
    transcript = {
      rounds: [{
        round: 1,
        focus: 'Direct Pitch',
        founderInput: options.initialPitch,
        vcResponse: '(pitch meeting skipped)',
      }],
      totalRounds: 1,
    };
  } else {
    transcript = await runPitchMeeting(llm, options.initialPitch);
  }

  // Phase B: The Revised Pitch
  const revisedPitch = await synthesizeRevisedPitch(llm, transcript);

  // Phase C: Generation
  console.log('');
  console.log(chalk.bold.yellow('═══ PHASE C: GENERATION ═══'));
  console.log('');

  const spinner = ora({ text: 'Generating...', color: 'cyan' });

  // C.1: Agent Team
  spinner.start('Generating agent team...');
  spinner.stop();
  const agentConfig = await generateAgentTeam(llm, revisedPitch);

  // C.2: Work Modules
  spinner.start('Generating work modules...');
  spinner.stop();
  const workerConfig = await generateWorkerConfig(llm, revisedPitch, agentConfig);

  // C.3: Strategy
  spinner.start('Generating strategy...');
  spinner.stop();
  const strategy = await generateStrategy(llm, transcript, revisedPitch, startupName);

  // C.4: Config Output
  spinner.start('Generating configs...');
  spinner.stop();
  const configs = generateConfigs(startupName, agentConfig, workerConfig);

  return {
    transcript,
    revisedPitch,
    agentConfig,
    workerConfig,
    strategy,
    configs,
  };
}
