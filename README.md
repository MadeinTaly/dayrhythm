# dayrhythm

A zero-dependency web component, `<day-rhythm>`, to edit a **24-hour cyclic schedule of time slots**, optionally across a **week**. Heating setpoints, lamp scenes, watering, blinds, opening hours: you bring the meaning, dayrhythm handles time, slots, dragging, the week and accessibility, and gives you plain JSON back.

**Live demo and playground: https://madeintaly.github.io/dayrhythm/**

Made with dayrhythm? A small credit link is built in and can be removed (`credits: false`).

## Why

- Zero config works: the tag alone renders a valid on/off day.
- One JSON `config` for everything (attribute, property or a `<script type="application/json">` child).
- Daily (a plain array) or weekly (`{ week: { mon: [...], ... } }`) with carry-over between days.
- Pure DOM-free core for Node servers, with shared test vectors for ports in other languages.
- Accessible (slider handles, keyboard, native dialogs), responsive, themeable, Tailwind friendly.
- **No Apply button.** The component emits `input` (while dragging) and `change` (committed edits). Your app decides when and how to save, with its own button.

## Screenshots

_Placeholders, to be added:_ `docs/img/organic-light.png`, `docs/img/organic-dark.png`, `docs/img/neutral.png`, `docs/img/flat.png`, `docs/img/weekly.png`, `docs/img/editor-dialog.png`, `docs/img/vertical-mobile.png`.

## Quick start

CDN (single file, global `DayRhythm`):

```html
<day-rhythm id="d"></day-rhythm>
<script src="https://cdn.jsdelivr.net/npm/dayrhythm/dist/dayrhythm.min.js"></script>
<script>
  d.addEventListener('change', (e) => console.log(e.detail.value));
</script>
```

npm (ES modules, no build step needed):

```js
import 'dayrhythm';
import thermostat from 'dayrhythm/packs/thermostat';

const el = document.querySelector('day-rhythm');
el.config = { ...thermostat, minGap: 30 };
el.addEventListener('change', (e) => save(e.detail.resolved));
```

Node (CommonJS or ESM), for example to know what is active now:

```js
const { activeSlotAt } = require('dayrhythm/core');
activeSlotAt(slots, new Date(), { timeZone: 'Europe/Rome' }); // -> { slot, start, end, elapsed, remaining }
```

React (peer dependency `react >= 18`, SSR-safe):

```tsx
import { DayRhythm } from 'dayrhythm/react';
<DayRhythm config={cfg} value={slots} onChange={(v) => setSlots(v)} />
```

Vue, Svelte and others: see `docs/API.md` section 14.

## Packs

Sixteen ready-made configs under `packs/` (light-scenes, aquarium-reef, screen-filter, thermostat, irrigation, blinds, pool-pump, ev-charging, grow-light, office-hours, water-heater, ventilation, pet-feeder, presence-simulation, garden-lighting, sleep-wake). Each has models with icons and colours, presets, and English and Italian labels; a pack is a plain object (`el.config = pack`) and has a JSON twin (`packs/<id>.json`). Field ranges are illustrative. A demo page per pack lives in `examples/packs/`.

Optional line icons (from [Lucide](https://lucide.dev), ISC), referenced by name: `dayrhythm/icons` exports `icons`, ~480 24x24 inline SVG strings (`stroke="currentColor"`, so CSS `color` tints them), and `icons/catalog.json` lists each with category and English/Italian keywords. Register them once, then any model can say `"icon": "sunrise"` (or `"lucide:moon-star"`): `import { icons } from 'dayrhythm'; import { icons as lib } from 'dayrhythm/icons'; icons.register(lib)` (or load `dist/dayrhythm-icons.min.js` after the element script). `icons.register({ mine: '<svg…>' })` adds your own; an unknown name shows as text and warns once. `withLineIcons(pack)` from `dayrhythm/packs` returns a JSON copy of a pack with every model `icon` swapped from emoji to the matching line icon; the packs themselves keep their emoji.

## Theming

Themes: `organic` (default), `neutral`, `flat`, `none` (headless). Customise with:

- CSS variables, e.g. `day-rhythm { --dr-accent: #7c3aed; --dr-radius-card: 4px; }` (dark mode: define them under your own selector, or set `color-scheme`).
- `::part(slot-active)` and friends in shadow mode.
- `classes` per part, and `render="light"` so page utility classes (Tailwind) reach the parts.

### JSON themes

`theme` also takes a whole theme as JSON: colours per scheme, shape, and optional per-part declarations.

```js
el.theme = {
  id: 'mine',
  light: { bg: '#fff', surface: '#fff', ink: '#111', muted: '#555', accent: '#0a7', border: '#ddd' },
  dark: { bg: '#111', surface: '#1b1b1b', ink: '#eee', muted: '#aaa', accent: '#4d9', border: '#333' },
  shape: { 'radius-card': '8px', font: 'system-ui, sans-serif' },
  skin: { '.dr-slot-time': 'font-family: ui-monospace, monospace' },
};
```

Eight ready-made themes ship as `dayrhythm/themes` (outside the element bundle): **Dose, Blueprint, Console,
Terminal, Ultraviolet, Brutal, Garden, Sticker**. Pass one as `theme`, or register them and use the names:

```js
import { themes } from 'dayrhythm';
import set from 'dayrhythm/themes';
Object.values(set).forEach((t) => themes.register(t));
el.theme = 'dose';
```

From a CDN: load `dist/dayrhythm-themes.min.js` after `dayrhythm.min.js` and they register themselves. The themes
name web fonts with system fallbacks: load the fonts on your page for the exact look. Gallery: `site/themes.html`.

The theme set was designed with the wonderful [Hallmark](https://www.usehallmark.com/).

<details><summary>Hallmark license (MIT)</summary>

```
MIT License

Copyright (c) 2026 Hallmark contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
</details>

<details><summary>Lucide license (ISC)</summary>

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
</details>

## Credits and donation

By default the component shows a small "Made with dayrhythm" link to this repository. `credits: false` removes it, `credits: "support"` adds a donation link (never on by default). The library makes no network requests for this.

## Support

dayrhythm is free (MIT). If it is useful to you, an optional donation is welcome: https://gt.1471995.xyz

## AI skill

A Claude Code / Agent skill turns a plain-language use case ("irrigazione orto, 3 zone, settimanale") into a valid config. Install it by copying `skill/dayrhythm` (or `node_modules/dayrhythm/skill/dayrhythm`) into `~/.claude/skills/` or a project's `.claude/skills/`.

It starts from the closest pack, picks icons by name from `icons/catalog.json` and a theme from the look you describe, outputs the config JSON plus an embed snippet, and checks it with `node skill/dayrhythm/scripts/validate.mjs config.json`.

## Development

`npm test` (Node test runner, no dependencies), `scripts/touch-check.mjs` (real touch drags in a mobile-emulated Chrome), `npm run build` (esbuild through `npx`), `npm run serve` then open `/site/` or `/examples/`. The contract is `docs/API.md`; design choices are in `docs/DECISIONS.md`.

## License

MIT, see `LICENSE`.
