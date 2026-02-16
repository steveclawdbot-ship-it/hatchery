import { createInterface } from 'readline';
import chalk from 'chalk';
import { GenerateOptions, LLMProvider } from '../llm/provider.js';
import { VC_SYSTEM_PROMPT } from './prompts/vc-persona.js';
import { PITCH_ROUNDS, RoundConfig } from './prompts/pitch-rounds.js';

const EMPTY_RESPONSE_RETRY_INSTRUCTION = `Your previous response was empty. Reply now using the required four-part format:
1) Story beat
2) Operational input
3) Planning move
4) Question
Your reply must be non-empty and must end with "Question: ...?"`;

const EMERGENCY_FALLBACK_BY_ROUND: Record<
  number,
  { risk: string; move: string; question: string }
> = {
  1: {
    risk: 'the story lacks a concrete user, trigger event, and desired outcome',
    move: 'define one primary user persona, the pain event that triggers use, and a measurable near-term outcome',
    question:
      'Who is the first user persona, what event triggers usage, and what measurable outcome do they need within 7 days?',
  },
  2: {
    risk: 'there is no measurable baseline to prove improvement',
    move: 'capture current alternatives and baseline metrics for time, cost, quality, or error rate',
    question:
      'What are users doing today, and what baseline metric will you improve first?',
  },
  3: {
    risk: 'goals and missions are not yet verifiable',
    move: 'set 2-4 measurable 30-day goals and define the first 3 missions with explicit done criteria',
    question:
      'What are your top 3 30-day goals, and what exact metric/target/deadline defines success for each?',
  },
  4: {
    risk: 'agent ownership and handoffs are ambiguous',
    move: 'assign mission ownership per agent and define handoff plus escalation rules for failures',
    question:
      'Which agent owns each mission, and what is the fallback handoff when that agent cannot complete a step?',
  },
  5: {
    risk: 'missions are not translated into an executable prioritized backlog',
    move: 'define top-priority tasks with dependencies, triggers, and acceptance tests',
    question:
      'What are the top 5 tasks to run first, and what dependency or trigger unlocks each one?',
  },
  6: {
    risk: 'the operating contract for week one is still unclear',
    move: 'commit to a first-week schedule, KPI cadence, and one owner for each critical risk',
    question:
      'What is your week-one execution plan, and which KPI checkpoint will prove you are on track?',
  },
};

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
  console.log(chalk.dim('  Strategy Guide:'));
  const lines = text.split('\n');
  for (const line of lines) {
    console.log(chalk.white(`  ${line}`));
  }
  console.log('');
}

async function generateVcResponse(
  llm: LLMProvider,
  promptText: string,
  options: GenerateOptions,
): Promise<{ text: string; streamedToConsole: boolean }> {
  if (!llm.generateStream) {
    return {
      text: await llm.generate(promptText, options),
      streamedToConsole: false,
    };
  }

  try {
    const stream = llm.generateStream(promptText, options);
    let text = '';
    let printedHeader = false;
    let atLineStart = true;

    for await (const chunk of stream) {
      if (!chunk) continue;
      text += chunk;

      if (!printedHeader) {
        console.log('');
        console.log(chalk.dim('  Strategy Guide:'));
        printedHeader = true;
      }

      for (const character of chunk) {
        if (atLineStart) {
          process.stdout.write(chalk.white('  '));
          atLineStart = false;
        }
        process.stdout.write(chalk.white(character));
        if (character === '\n') {
          atLineStart = true;
        }
      }
    }

    if (printedHeader) {
      if (!text.endsWith('\n')) {
        process.stdout.write('\n');
      }
      console.log('');
    }

    return { text, streamedToConsole: printedHeader };
  } catch {
    return {
      text: await llm.generate(promptText, options),
      streamedToConsole: false,
    };
  }
}

function buildEmergencyVcFallback(roundConfig: RoundConfig): string {
  const template = EMERGENCY_FALLBACK_BY_ROUND[roundConfig.round] ?? EMERGENCY_FALLBACK_BY_ROUND[3];
  return [
    `Story beat: you are working through ${roundConfig.focus.toLowerCase()} and sharpening the execution narrative.`,
    `Operational input: the main missing variable is that ${template.risk}.`,
    `Planning move: ${template.move}.`,
    `Question: ${template.question}`,
  ].join('\n');
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
  console.log(chalk.bold.cyan('║  A VC-style guide will extract your execution plan║'));
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
      console.log(chalk.red('  You need to say something. Your strategy guide is waiting.'));
      founderInput = await prompt(chalk.green('  Try again: '));
    }

    conversationHistory.push({ role: 'user', content: founderInput });

    const systemPrompt = `${VC_SYSTEM_PROMPT}\n\n${roundConfig.systemAddendum}`;
    const contextPrompt = conversationHistory
      .map((m) => `${m.role === 'user' ? 'Founder' : 'Guide'}: ${m.content}`)
      .join('\n\n');

    let { text: vcResponse, streamedToConsole } = await generateVcResponse(llm, contextPrompt, {
      tier: 'expensive',
      system: systemPrompt,
      temperature: 0.8,
    });
    if (!/\S/.test(vcResponse)) {
      console.log(chalk.yellow('  VC returned an empty response. Retrying once...'));
      vcResponse = await llm.generate(contextPrompt, {
        tier: 'expensive',
        system: `${systemPrompt}\n\n${EMPTY_RESPONSE_RETRY_INSTRUCTION}`,
        temperature: 0.55,
      });
      streamedToConsole = false;
    }
    if (!/\S/.test(vcResponse)) {
      vcResponse = buildEmergencyVcFallback(roundConfig);
      streamedToConsole = false;
    }

    conversationHistory.push({ role: 'assistant', content: vcResponse });
    if (!streamedToConsole) {
      printVCResponse(vcResponse);
    }

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
