// Emits function-free JSON twins of every pack (packs/<id>.json) for non-JS consumers.
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { packs } = await import(pathToFileURL(join(root, 'packs/index.js')));
for (const [id, p] of Object.entries(packs)) {
  writeFileSync(join(root, 'packs', `${id}.json`), JSON.stringify(p, (k, v) => (typeof v === 'function' ? undefined : v), 2) + '\n');
}
console.log(`wrote ${Object.keys(packs).length} pack JSON files`);
