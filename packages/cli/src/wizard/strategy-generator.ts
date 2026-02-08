import chalk from 'chalk';
import { LLMProvider } from '../llm/provider.js';
import { STRATEGY_GENERATION_PROMPT } from './prompts/generation.js';
import { PitchTranscript } from './pitch-meeting.js';
import { RevisedPitch } from './revised-pitch.js';

export async function generateStrategy(
  llm: LLMProvider,
  transcript: PitchTranscript,
  revisedPitch: RevisedPitch,
  startupName: string,
): Promise<string> {
  console.log(chalk.dim('  Step 3/4: Generating STRATEGY.md...'));

  const transcriptText = transcript.rounds
    .map(
      (r) =>
        `Round ${r.round} (${r.focus}):\nFounder: ${r.founderInput}\nVC: ${r.vcResponse}`,
    )
    .join('\n\n');

  const strategy = await llm.generate(
    `${STRATEGY_GENERATION_PROMPT}\n\nStartup name: ${startupName}\n\n--- PITCH MEETING TRANSCRIPT ---\n${transcriptText}\n\n--- REVISED PITCH ---\n${revisedPitch.raw}`,
    {
      tier: 'expensive',
      system: 'You are a startup strategist. Write actionable strategy documents, not fluffy mission statements.',
      temperature: 0.6,
      maxTokens: 4000,
    },
  );

  console.log(chalk.green('  ✓ STRATEGY.md generated'));
  console.log('');

  return strategy;
}
