import { existsSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';

interface Check {
  name: string;
  test: () => boolean | Promise<boolean>;
  fix?: string;
}

export async function doctorCommand() {
  console.log('');
  console.log(chalk.bold.cyan('  Hatchery Doctor'));
  console.log(chalk.dim('  Checking system prerequisites...'));
  console.log('');

  let allGood = true;

  const checks: Check[] = [
    {
      name: 'Node.js >= 20',
      test: () => {
        const major = parseInt(process.version.slice(1).split('.')[0], 10);
        return major >= 20;
      },
      fix: 'Install Node.js 20+ (https://nodejs.org)',
    },
    {
      name: 'npm available',
      test: () => {
        try {
          require('child_process').execSync('npm --version', { stdio: 'pipe' });
          return true;
        } catch {
          return false;
        }
      },
      fix: 'npm should come with Node.js',
    },
    {
      name: 'LLM API key configured',
      test: () => {
        return !!(
          process.env.ANTHROPIC_API_KEY ||
          process.env.OPENAI_API_KEY ||
          process.env.GOOGLE_API_KEY ||
          process.env.KIMI_API_KEY
        );
      },
      fix: 'Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, KIMI_API_KEY',
    },
    {
      name: 'Supabase credentials',
      test: () => {
        return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
      },
      fix: 'Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables',
    },
  ];

  // Check if we're in a Hatchery project
  const inProject = existsSync(resolve('.', 'config', 'agents.json'));
  if (inProject) {
    checks.push(
      {
        name: 'agents.json valid',
        test: () => {
          try {
            const content = require('fs').readFileSync(resolve('.', 'config', 'agents.json'), 'utf-8');
            JSON.parse(content);
            return true;
          } catch {
            return false;
          }
        },
        fix: 'Check config/agents.json for JSON syntax errors',
      },
      {
        name: 'policies.json valid',
        test: () => {
          try {
            const content = require('fs').readFileSync(resolve('.', 'config', 'policies.json'), 'utf-8');
            JSON.parse(content);
            return true;
          } catch {
            return false;
          }
        },
        fix: 'Check config/policies.json for JSON syntax errors',
      },
    );
  }

  for (const check of checks) {
    try {
      const passed = await check.test();
      if (passed) {
        console.log(chalk.green(`  ✓ ${check.name}`));
      } else {
        console.log(chalk.red(`  ✗ ${check.name}`));
        if (check.fix) {
          console.log(chalk.dim(`    Fix: ${check.fix}`));
        }
        allGood = false;
      }
    } catch {
      console.log(chalk.red(`  ✗ ${check.name} (error)`));
      allGood = false;
    }
  }

  console.log('');
  if (allGood) {
    console.log(chalk.bold.green('  All checks passed!'));
  } else {
    console.log(chalk.bold.yellow('  Some issues found. Fix them and run again.'));
  }
  console.log('');
}
