import chalk from 'chalk';
import { createInterface } from 'readline';
import { LLMProvider } from '../llm/provider.js';
import { VC_REVISION_PROMPT } from './prompts/vc-persona.js';
import { REVISED_PITCH_PROMPT } from './prompts/revised-pitch.js';
import { PitchTranscript } from './pitch-meeting.js';

export interface RevisedPitch {
  raw: string;
  approved: boolean;
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function formatTranscript(transcript: PitchTranscript): string {
  return transcript.rounds
    .map(
      (r) =>
        `--- Round ${r.round}: ${r.focus} ---\nFounder: ${r.founderInput}\nVC: ${r.vcResponse}`,
    )
    .join('\n\n');
}

export async function synthesizeRevisedPitch(
  llm: LLMProvider,
  transcript: PitchTranscript,
): Promise<RevisedPitch> {
  console.log('');
  console.log(chalk.bold.yellow('═══ PHASE B: THE REVISED PITCH ═══'));
  console.log(chalk.dim('  Synthesizing the pitch meeting into a clean brief...'));
  console.log('');

  const transcriptText = formatTranscript(transcript);

  const revisedPitch = await llm.generate(
    `${REVISED_PITCH_PROMPT}\n\n--- PITCH MEETING TRANSCRIPT ---\n${transcriptText}`,
    {
      tier: 'mid',
      system: VC_REVISION_PROMPT,
      temperature: 0.6,
      maxTokens: 3000,
    },
  );

  console.log(chalk.bold.white('  ┌─────────────────────────────────────────┐'));
  const lines = revisedPitch.split('\n');
  for (const line of lines) {
    console.log(chalk.white(`  │ ${line}`));
  }
  console.log(chalk.bold.white('  └─────────────────────────────────────────┘'));
  console.log('');

  let approved = false;
  while (!approved) {
    const choice = await prompt(
      chalk.green('  Approve this revised pitch? (yes/edit/redo): '),
    );

    if (choice.toLowerCase() === 'yes' || choice.toLowerCase() === 'y') {
      approved = true;
    } else if (choice.toLowerCase() === 'redo') {
      console.log(chalk.dim('  Re-synthesizing...'));
      return synthesizeRevisedPitch(llm, transcript);
    } else if (choice.toLowerCase() === 'edit') {
      const edits = await prompt(
        chalk.green('  What would you like to change? '),
      );
      const edited = await llm.generate(
        `Take this revised pitch and apply the following changes:\n\nChanges: ${edits}\n\nOriginal pitch:\n${revisedPitch}\n\nOutput the full revised pitch with changes applied.`,
        {
          tier: 'mid',
          system: VC_REVISION_PROMPT,
          temperature: 0.5,
        },
      );
      console.log('');
      const editedLines = edited.split('\n');
      for (const line of editedLines) {
        console.log(chalk.white(`  │ ${line}`));
      }
      console.log('');
      const confirm = await prompt(
        chalk.green('  Approve this version? (yes/edit/redo): '),
      );
      if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
        return { raw: edited, approved: true };
      }
    }
  }

  return { raw: revisedPitch, approved: true };
}
