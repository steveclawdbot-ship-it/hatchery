import { Command } from 'commander';

const program = new Command();

program
  .name('hatchery')
  .description('AI Startup in a Box — spin up a fully configured AI-agent company from a startup pitch')
  .version('0.1.0')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-q, --quiet', 'Suppress non-error output');

program.hook('preAction', (_thisCommand, actionCommand) => {
  const opts = actionCommand.optsWithGlobals();
  if (opts.verbose) {
    process.env.HATCHERY_VERBOSE = '1';
  }
  if (opts.quiet) {
    process.env.HATCHERY_QUIET = '1';
  }
});

program
  .command('create <name>')
  .description('Create a new AI startup from a pitch meeting')
  .option('-p, --provider <provider>', 'LLM provider (anthropic, openai, google, kimi)', 'anthropic')
  .option('-o, --output <dir>', 'Output directory', '.')
  .option('--skip-meeting', 'Skip pitch meeting (use provided pitch directly)')
  .option('--pitch <pitch>', 'Startup pitch (skips interactive prompt)')
  .action(async (name: string, options) => {
    const { createCommand } = await import('./commands/create.js');
    await createCommand(name, options);
  });

program
  .command('doctor')
  .description('Check system health and prerequisites')
  .action(async () => {
    const { doctorCommand } = await import('./commands/doctor.js');
    await doctorCommand();
  });

program
  .command('deploy <target>')
  .description('Deploy components (db, api, workers)')
  .option('--supabase-url <url>', 'Supabase project URL')
  .option('--supabase-key <key>', 'Supabase service role key')
  .action(async (target: string, options) => {
    const { deployCommand } = await import('./commands/deploy.js');
    await deployCommand(target, options);
  });

program
  .command('secrets')
  .description('Manage secrets for a Hatchery project')
  .argument('<action>', 'Action (set, list, remove)')
  .argument('[key]', 'Secret key')
  .argument('[value]', 'Secret value')
  .action(async (action: string, key?: string, value?: string) => {
    const { secretsCommand } = await import('./commands/secrets.js');
    await secretsCommand(action, key, value);
  });

program.parse();
