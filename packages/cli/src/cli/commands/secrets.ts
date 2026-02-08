import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';

export async function secretsCommand(action: string, key?: string, value?: string) {
  const envPath = resolve('.', '.env');

  switch (action) {
    case 'set': {
      if (!key || !value) {
        console.log(chalk.red('  Usage: hatchery secrets set KEY VALUE'));
        return;
      }
      const env = loadEnv(envPath);
      env[key] = value;
      saveEnv(envPath, env);
      console.log(chalk.green(`  ✓ Set ${key}`));
      break;
    }
    case 'list': {
      const env = loadEnv(envPath);
      console.log('');
      for (const [k, v] of Object.entries(env)) {
        const masked = v.length > 8 ? v.slice(0, 4) + '…' + v.slice(-4) : '****';
        console.log(chalk.white(`  ${k}=${masked}`));
      }
      console.log('');
      break;
    }
    case 'remove': {
      if (!key) {
        console.log(chalk.red('  Usage: hatchery secrets remove KEY'));
        return;
      }
      const env = loadEnv(envPath);
      delete env[key];
      saveEnv(envPath, env);
      console.log(chalk.green(`  ✓ Removed ${key}`));
      break;
    }
    default:
      console.log(chalk.red(`  Unknown action: ${action}`));
      console.log(chalk.dim('  Valid actions: set, list, remove'));
  }
}

function loadEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const content = readFileSync(path, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
  return env;
}

function saveEnv(path: string, env: Record<string, string>) {
  const content = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  writeFileSync(path, content + '\n', 'utf-8');
}
