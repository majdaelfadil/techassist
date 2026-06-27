import chalk from 'chalk';

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  const ts = chalk.gray(`[${timestamp()}]`);
  const extra = args.length > 0 ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : '';

  switch (level) {
    case 'info':
      console.log(`${ts} ${chalk.blue('INFO')}  ${message}${extra}`);
      break;
    case 'success':
      console.log(`${ts} ${chalk.green('OK')}    ${message}${extra}`);
      break;
    case 'warn':
      console.log(`${ts} ${chalk.yellow('WARN')}  ${message}${extra}`);
      break;
    case 'error':
      console.error(`${ts} ${chalk.red('ERROR')} ${message}${extra}`);
      break;
    case 'debug':
      if (process.env.DEBUG) {
        console.log(`${ts} ${chalk.gray('DEBUG')} ${message}${extra}`);
      }
      break;
  }
}

export const logger = {
  info: (msg: string, ...args: unknown[]) => log('info', msg, ...args),
  success: (msg: string, ...args: unknown[]) => log('success', msg, ...args),
  warn: (msg: string, ...args: unknown[]) => log('warn', msg, ...args),
  error: (msg: string, ...args: unknown[]) => log('error', msg, ...args),
  debug: (msg: string, ...args: unknown[]) => log('debug', msg, ...args),

  progress: (current: number, total: number, label: string) => {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
    process.stdout.write(`\r${chalk.gray(`[${timestamp()}]`)} ${chalk.cyan(label)} |${bar}| ${pct}% (${current}/${total})`);
    if (current >= total) process.stdout.write('\n');
  },
};
