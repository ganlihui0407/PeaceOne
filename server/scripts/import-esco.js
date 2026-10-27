import '../src/config.js';
import { runEscoCli } from '../src/lib/esco/importEsco.js';

const result = await runEscoCli(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
});

process.exit(result.code);
