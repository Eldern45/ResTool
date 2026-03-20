import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Repl } from './repl';

async function main(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });
  const repl = new Repl(rl);

  try {
    await repl.run();
  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
