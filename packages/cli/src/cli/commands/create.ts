import { existsSync } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline';
import chalk from 'chalk';
import { createProvider, ProviderName } from '../../llm/provider.js';
import { runWizard } from '../../wizard/index.js';
import { scaffoldProject } from '../../scaffolder/index.js';

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(question, (answer) => {
      rl.close();
      res(answer.trim());
    });
  });
}

export async function createCommand(
  name: string,
  options: {
    provider: string;
    output: string;
    skipMeeting?: boolean;
    pitch?: string;
  },
) {
  const outputDir = resolve(options.output);
  const projectDir = resolve(outputDir, name);

  if (existsSync(projectDir)) {
    console.log(chalk.red(`  Directory already exists: ${projectDir}`));
    const overwrite = await prompt(chalk.yellow('  Overwrite? (y/N): '));
    if (overwrite.toLowerCase() !== 'y') {
      console.log(chalk.dim('  Aborted.'));
      return;
    }
  }

  // Resolve API key
  const provider = options.provider as ProviderName;
  const envKeyMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_API_KEY',
    kimi: 'KIMI_API_KEY',
  };

  const envKey = envKeyMap[provider];
  let apiKey = envKey ? process.env[envKey] : undefined;

  if (!apiKey) {
    apiKey = await prompt(
      chalk.yellow(`  Enter your ${provider} API key: `),
    );
    if (!apiKey) {
      console.log(chalk.red('  API key required.'));
      process.exit(1);
    }
  }

  // Create LLM provider
  const llm = await createProvider(provider, apiKey);

  // Run wizard
  const result = await runWizard(llm, name, {
    initialPitch: options.pitch,
    skipMeeting: options.skipMeeting,
  });

  // Scaffold project
  const dir = scaffoldProject(result, {
    name,
    outputDir,
    provider,
  });

  // Print next steps
  console.log(chalk.bold.cyan('  Next steps:'));
  console.log(chalk.white(`  1. cd ${dir}`));
  console.log(chalk.white('  2. Edit .env with your Supabase credentials'));
  console.log(chalk.white('  3. Run migrations: hatchery deploy db'));
  console.log(chalk.white('  4. Seed data: npm run seed'));
  console.log(chalk.white('  5. Start heartbeat: npm run heartbeat'));
  console.log('');
  console.log(chalk.bold.green('  Your AI startup is ready to hatch.'));
  console.log('');
}
