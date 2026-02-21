import { init } from './commands/init.js';
import { validate } from './commands/validate.js';

const HELP = `
stop-cli — STOP Protocol CLI

Usage:
  stop init              Generate a skill.yaml interactively
  stop validate [path]   Validate a skill.yaml file
  stop help              Show this help

https://github.com/echoVic/stop-protocol
`.trim();

export function main(args: string[]) {
  const cmd = args[0];

  switch (cmd) {
    case 'init':
      init();
      break;
    case 'validate':
      validate(args[1]);
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      console.log(HELP);
      break;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}
