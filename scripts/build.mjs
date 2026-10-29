// Dev-only build. The source in src/ works without it; this produces dist/ (IIFE + ESM + CJS) and site/vendor.
// Uses esbuild through npx (no dependency is added to the package).
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ESBUILD = 'esbuild@0.25.10';
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
// npx is npx.cmd on Windows (execFile cannot run it, a shell would mangle the banner): call npm's npx-cli with node
const WIN_NPX = join(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
const [NPX, NPX_ARGS] = process.platform === 'win32' ? [process.execPath, [WIN_NPX]] : ['npx', []];
const banner = `/*! dayrhythm v${pkg.version} | MIT | https://github.com/MadeinTaly/dayrhythm */`;

function esb(entry, out, opts = []) {
  const args = ['--yes', ESBUILD, join(root, entry), '--bundle', '--target=es2020', `--outfile=${join(root, out)}`, `--banner:js=${banner}`, '--legal-comments=none', '--log-level=warning', ...opts];
  execFileSync(NPX, [...NPX_ARGS, ...args], { stdio: 'inherit', cwd: root });
  console.log('built', out);
}

mkdirSync(join(root, 'dist'), { recursive: true });
mkdirSync(join(root, 'site/vendor'), { recursive: true });

// element bundle
esb('src/index.js', 'dist/dayrhythm.min.js', ['--format=iife', '--global-name=DayRhythm', '--minify', '--charset=utf8', '--mangle-props=^_[a-zA-Z]']);
esb('src/index.js', 'dist/dayrhythm.js', ['--format=esm']);
esb('src/index.js', 'dist/dayrhythm.esm.min.js', ['--format=esm', '--minify']);
// core (DOM-free): ESM + CJS for Node servers
esb('src/core/index.js', 'dist/dayrhythm-core.js', ['--format=esm']);
esb('src/core/index.js', 'dist/dayrhythm-core.min.js', ['--format=esm', '--minify']);
esb('src/core/index.js', 'dist/dayrhythm-core.cjs', ['--format=cjs', '--platform=node']);
// packs (not part of the element bundle)
esb('packs/index.js', 'dist/dayrhythm-packs.js', ['--format=esm', '--minify']);
esb('scripts/entries/packs-iife.js', 'dist/dayrhythm-packs.min.js', ['--format=iife', '--minify']);
esb('icons/index.js', 'dist/dayrhythm-icons.js', ['--format=esm', '--minify']);
esb('scripts/entries/icons-iife.js', 'dist/dayrhythm-icons.min.js', ['--format=iife', '--minify']);
copyFileSync(join(root, 'icons/catalog.json'), join(root, 'dist/icons-catalog.json'));
// themes (not part of the element bundle)
esb('themes/index.js', 'dist/dayrhythm-themes.js', ['--format=esm', '--minify']);
esb('scripts/entries/themes-iife.js', 'dist/dayrhythm-themes.min.js', ['--format=iife', '--minify']);
// react wrapper (react stays external, size reference only; the published file is react/index.js)
esb('react/index.js', 'dist/react.min.js', ['--format=esm', '--minify', '--charset=utf8', '--external:react', '--external:react-dom', '--external:../src/*']);

// site: self-contained copy of what the pages import
esb('src/index.js', 'site/vendor/dayrhythm.js', ['--format=esm', '--minify']);
esb('packs/index.js', 'site/vendor/packs.js', ['--format=esm', '--minify']);
esb('icons/index.js', 'site/vendor/icons.js', ['--format=esm', '--minify']);
esb('themes/index.js', 'site/vendor/themes.js', ['--format=esm', '--minify']);
copyFileSync(join(root, 'schema/config.schema.json'), join(root, 'site/vendor/config.schema.json'));
copyFileSync(join(root, 'schema/validate.js'), join(root, 'site/vendor/schema-validate.js'));
copyFileSync(join(root, 'icons/catalog.json'), join(root, 'site/vendor/icons-catalog.json'));
writeFileSync(join(root, 'site/vendor/VERSION'), pkg.version + '\n');
console.log('done');
