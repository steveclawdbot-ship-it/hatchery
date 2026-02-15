import { createInterface } from 'readline';
import chalk from 'chalk';
import { LLMProvider } from '../llm/provider.js';
import { VC_SYSTEM_PROMPT } from './prompts/vc-persona.js';
import { PITCH_ROUNDS, RoundConfig } from './prompts/pitch-rounds.js';

export interface PitchTranscript {
  rounds: Array<{
    round: number;
    focus: string;
    founderInput: string;
    vcResponse: string;
  }>;
  totalRounds: number;
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

function printHeader(round: RoundConfig) {
  console.log('');
  console.log(chalk.bold.yellow(`═══ Round ${round.round}: ${round.focus.toUpperCase()} ═══`));
  console.log('');
}

function printVCResponse(text: string) {
  console.log('');
  console.log(chalk.dim('  VC Partner:'));
  const lines = text.split('\n');
  for (const line of lines) {
    console.log(chalk.white(`  ${line}`));
  }
  console.log('');
}

export async function runPitchMeeting(
  llm: LLMProvider,
  initialPitch?: string,
): Promise<PitchTranscript> {
  const transcript: PitchTranscript = { rounds: [], totalRounds: 0 };
  const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  console.log('');
  console.log(chalk.bold.cyan('╔══════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║          THE PITCH MEETING                       ║'));
  console.log(chalk.bold.cyan('║  You are pitching to a startup incubator.        ║'));
  console.log(chalk.bold.cyan('║  They will challenge you. That is the point.     ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════╝'));
  console.log('');

  const minRounds = 4;
  const maxRounds = 6;

  for (let i = 0; i < maxRounds; i++) {
    const roundConfig = PITCH_ROUNDS[i];
    printHeader(roundConfig);

    let founderInput: string;
    if (i === 0 && initialPitch) {
      console.log(chalk.dim('  (Using provided pitch)'));
      console.log(chalk.white(`  ${initialPitch}`));
      console.log('');
      founderInput = initialPitch;
    } else if (i === 0) {
      founderInput = await prompt(chalk.green('  Your pitch: '));
    } else {
      founderInput = await prompt(chalk.green('  Your response: '));
    }

    if (!founderInput) {
      console.log(chalk.red('  You need to say something. The VC is waiting.'));
      founderInput = await prompt(chalk.green('  Try again: '));
    }

    conversationHistory.push({ role: 'user', content: founderInput });

    const systemPrompt = `${VC_SYSTEM_PROMPT}\n\n${roundConfig.systemAddendum}`;
    const contextPrompt = conversationHistory
      .map((m) => `${m.role === 'user' ? 'Founder' : 'VC'}: ${m.content}`)
      .join('\n\n');

    const vcResponse = await llm.generate(contextPrompt, {
      tier: 'expensive',
      system: systemPrompt,
      temperature: 0.8,
    });

    conversationHistory.push({ role: 'assistant', content: vcResponse });
    printVCResponse(vcResponse);

    transcript.rounds.push({
      round: i + 1,
      focus: roundConfig.focus,
      founderInput,
      vcResponse,
    });
    transcript.totalRounds = i + 1;

    // After minimum rounds, check if the VC is ready to synthesize
    if (i >= minRounds - 1) {
      const continueChoice = await prompt(
        chalk.dim(`  Continue to round ${i + 2}? (y/N): `),
      );
      if (continueChoice.toLowerCase() !== 'y') {
        break;
      }
    }
  }

  console.log('');
  console.log(chalk.bold.cyan('─── Pitch meeting complete. ───'));
  console.log(chalk.dim(`  ${transcript.totalRounds} rounds conducted.`));
  console.log('');

  return transcript;
}
