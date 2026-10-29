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

## Credits and donation

By default the component shows a small "Made with dayrhythm" link to this repository. `credits: false` removes it, `credits: "support"` adds a donation link (never on by default). The library makes no network requests for this.

## Support

dayrhythm is free (MIT). If it is useful to you, an optional donation is welcome: https://gt.1471995.xyz

## Development

`npm test` (Node test runner, no dependencies), `npm run build` (esbuild through `npx`), `npm run serve` then open `/site/` or `/examples/`. The contract is `docs/API.md`; design choices are in `docs/DECISIONS.md`.

## License

MIT, see `LICENSE`.
