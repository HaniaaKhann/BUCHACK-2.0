import { execFileSync } from 'node:child_process';

const composeArguments = (process.env['E2E_COMPOSE_ARGS'] ?? '').split(' ').filter(Boolean);
const composeDirectory = process.env['E2E_COMPOSE_DIR'] ?? process.cwd();

function compose(args: readonly string[]): string {
  return execFileSync('docker', ['compose', ...composeArguments, ...args], {
    cwd: composeDirectory,
    encoding: 'utf8',
  });
}

export function resetDemo(): void {
  compose(['exec', '-T', 'worker', './node_modules/.bin/tsx', 'src/demoResetCli.ts']);
}

export function sql(statement: string): string {
  return compose([
    'exec',
    '-T',
    'db',
    'psql',
    '-U',
    'postgres',
    '-d',
    'app',
    '-At',
    '-c',
    statement,
  ]).trim();
}
