// Prints min+gzip sizes against the targets of docs/API.md section 13.1. Exit code 1 above the hard limit only with --strict.
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const kb = (n) => (n / 1024).toFixed(2) + ' KB';
let failed = false;
const rows = [];

function row(name, bytes, target, hard) {
  const status = hard && bytes > hard * 1024 ? 'FAIL (hard limit)' : bytes > target * 1024 ? 'over target' : 'ok';
  if (status.startsWith('FAIL')) failed = true;
  rows.push([name, kb(bytes), `${target} KB` + (hard ? ` (hard ${hard})` : ''), status]);
}

const file = (p) => readFileSync(join(root, p));
row('dist/dayrhythm.min.js (IIFE)', gz(file('dist/dayrhythm.min.js')), 20, 26);
row('dist/dayrhythm-core.min.js', gz(file('dist/dayrhythm-core.min.js')), 3);
row('dist/react.min.js', gz(file('dist/react.min.js')), 1.5);
for (const f of readdirSync(join(root, 'packs')).filter((x) => x.endsWith('.js') && !['index.js', '_util.js'].includes(x))) {
  const out = execFileSync('npx', ['--yes', 'esbuild@0.25.10', join(root, 'packs', f), '--bundle', '--minify', '--format=esm', '--target=es2020', '--log-level=error'], { cwd: root });
  row(`packs/${f} (with shared builder)`, gz(out), 2);
}
const w = Math.max(...rows.map((r) => r[0].length));
for (const r of rows) console.log(`${r[0].padEnd(w)}  ${r[1].padStart(9)}  target ${r[2].padEnd(16)} ${r[3]}`);
if (failed && process.argv.includes('--strict')) process.exit(1);
