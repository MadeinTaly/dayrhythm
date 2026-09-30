// Generates examples/packs/<id>.html (one minimal page per pack) and examples/index.html (the playground with repo paths).
// Run after adding a pack: node scripts/gen-examples.mjs
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { packs } = await import(pathToFileURL(join(root, 'packs/index.js')));
mkdirSync(join(root, 'examples/packs'), { recursive: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

for (const p of Object.values(packs)) {
  const weekly = p.week === 'top';
  writeFileSync(join(root, `examples/packs/${p.id}.html`), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>dayrhythm - ${esc(p.title)} pack</title>
<link rel="stylesheet" href="../examples.css">
</head>
<body>
<main>
  <p><a href="../index.html">Playground</a> &middot; <a href="https://github.com/MadeinTaly/dayrhythm">GitHub</a></p>
  <h1>${esc(p.title)}</h1>
  <p>${esc(p.description)} ${weekly ? 'Weekly' : 'Daily'} schedule, pack id <code>${p.id}</code>. Needs a local static server (ES modules): <code>node scripts/serve.mjs</code>.</p>

  <label>Language <select id="lang"><option value="en">English</option><option value="it">Italiano</option></select></label>
  <label>Theme <select id="theme"><option>organic</option><option>neutral</option><option>flat</option></select></label>

  <day-rhythm id="d"></day-rhythm>

  <p class="host">
    <button id="apply" type="button" disabled>Apply</button>
    <span id="status" role="status"></span>
    <small>The Apply button is part of this page (the host app), not of the library.</small>
  </p>
  <h2>Value</h2>
  <pre id="out"></pre>
</main>
<script type="module">
  import '../../src/index.js';
  import pack from '../../packs/${p.id}.js';

  const d = document.getElementById('d');
  d.config = pack;                       // a pack is a plain config object

  const out = document.getElementById('out');
  const apply = document.getElementById('apply');
  let applied = JSON.stringify(d.value);
  const show = () => {
    out.textContent = JSON.stringify(d.value, null, 2);
    apply.disabled = JSON.stringify(d.value) === applied;
  };
  d.addEventListener('input', show);
  d.addEventListener('change', show);
  show();
  apply.addEventListener('click', () => {
    applied = JSON.stringify(d.value);                    // a real app would send d.getValue({ resolve: true }) to its server
    document.getElementById('status').textContent = 'Applied at ' + new Date().toLocaleTimeString();
    show();
  });
  document.getElementById('lang').addEventListener('change', (e) => { d.locale = e.target.value; });
  document.getElementById('theme').addEventListener('change', (e) => { d.theme = e.target.value; });
</script>
</body>
</html>
`);
}

// examples/index.html = the playground, pointed at the repo sources instead of site/vendor
let pg = readFileSync(join(root, 'site/playground.html'), 'utf8');
pg = pg.replace('./site.css', '../site/site.css').replace('./playground.js', '../site/playground.js')
  .replace(/<script>window\.DR_PATHS = .*?<\/script>/, "<script>window.DR_PATHS = { lib: '../src/index.js', packs: '../packs/index.js', validate: '../schema/validate.js', schema: '../schema/config.schema.json' };</script>")
  .replace(/href="\.\/(index|playground|packs)\.html"/g, 'href="../site/$1.html"')
  .replace('<title>dayrhythm playground</title>', '<title>dayrhythm gallery and playground (repo sources)</title>');
writeFileSync(join(root, 'examples/index.html'), pg);
console.log(`wrote ${Object.keys(packs).length} pack pages and examples/index.html`);
