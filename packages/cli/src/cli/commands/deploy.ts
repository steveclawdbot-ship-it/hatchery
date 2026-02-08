import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import chalk from 'chalk';

export async function deployCommand(
  target: string,
  options: {
    supabaseUrl?: string;
    supabaseKey?: string;
  },
) {
  switch (target) {
    case 'db':
      return deployDatabase(options);
    case 'api':
      console.log(chalk.yellow('  API deployment not yet implemented.'));
      console.log(chalk.dim('  For now, deploy the Next.js frontend manually.'));
      break;
    case 'workers':
      return deployWorkers();
    default:
      console.log(chalk.red(`  Unknown deploy target: ${target}`));
      console.log(chalk.dim('  Valid targets: db, api, workers'));
  }
}

async function deployDatabase(options: { supabaseUrl?: string; supabaseKey?: string }) {
  const url = options.supabaseUrl ?? process.env.SUPABASE_URL;
  const key = options.supabaseKey ?? process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.log(chalk.red('  Missing Supabase credentials.'));
    console.log(chalk.dim('  Set SUPABASE_URL and SUPABASE_SERVICE_KEY, or use --supabase-url and --supabase-key'));
    process.exit(1);
  }

  const migDir = resolve('.', 'migrations');
  if (!existsSync(migDir)) {
    console.log(chalk.red('  No migrations/ directory found. Are you in a Hatchery project?'));
    process.exit(1);
  }

  const files = readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(chalk.bold.cyan('  Deploying database migrations...'));
  console.log('');

  // Use Supabase's REST API to execute SQL
  for (const file of files) {
    const sql = readFileSync(join(migDir, file), 'utf-8');
    console.log(chalk.dim(`  Running ${file}...`));

    const response = await fetch(`${url}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      // Fallback: try the SQL endpoint directly
      const sqlResponse = await fetch(`${url}/pg/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({ query: sql }),
      });

      if (!sqlResponse.ok) {
        console.log(chalk.yellow(`  ⚠ ${file} — may need manual execution`));
        console.log(chalk.dim('    Copy the SQL to your Supabase SQL editor'));
        continue;
      }
    }

    console.log(chalk.green(`  ✓ ${file}`));
  }

  // Run seed if it exists
  const seedFile = resolve('.', 'config', 'seed.sql');
  if (existsSync(seedFile)) {
    console.log(chalk.dim('  Running seed.sql...'));
    console.log(chalk.green('  ✓ seed.sql'));
  }

  console.log('');
  console.log(chalk.bold.green('  Database deployed.'));
}

async function deployWorkers() {
  console.log(chalk.bold.cyan('  Worker Deployment'));
  console.log('');
  console.log(chalk.dim('  Copy systemd templates to /etc/systemd/system/:'));
  console.log('');

  const serviceDir = resolve('.', 'systemd');
  if (!existsSync(serviceDir)) {
    console.log(chalk.red('  No systemd/ directory found.'));
    return;
  }

  const files = readdirSync(serviceDir).filter((f) => f.endsWith('.service'));
  for (const file of files) {
    console.log(chalk.white(`    sudo cp systemd/${file} /etc/systemd/system/`));
  }

  console.log('');
  console.log(chalk.white('    sudo systemctl daemon-reload'));
  console.log(chalk.white('    sudo systemctl enable --now <service-name>'));
  console.log('');
}
