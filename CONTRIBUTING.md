# Contributing

- `src/` is plain ES2020 modules and works without a build. `npm test` runs the Node tests (`node --test`, no dependencies).
- `npm run build` regenerates `dist/` and `site/vendor/` (esbuild through `npx`, nothing is added to the package). Commit the output.
- `npm run serve` serves the repo on http://localhost:8080/ (open `/examples/` or `/site/`).
- New pack: add `packs/<id>.js` (use `packs/_util.js`), register it in `packs/index.js`, run `node scripts/gen-examples.mjs` and `npm test`.
- `docs/API.md` is the contract; behaviour changes need a doc change. Keep zero runtime dependencies and no personal data in the repo.
- By contributing you agree your work is released under the MIT license.
