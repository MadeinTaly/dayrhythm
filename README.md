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

## Credits and donation

By default the component shows a small "Made with dayrhythm" link to this repository. `credits: false` removes it, `credits: "support"` adds a donation link (never on by default). The library makes no network requests for this.

## Support

dayrhythm is free (MIT). If it is useful to you, an optional donation is welcome: https://gt.1471995.xyz

## Development

`npm test` (Node test runner, no dependencies), `npm run build` (esbuild through `npx`), `npm run serve` then open `/site/` or `/examples/`. The contract is `docs/API.md`; design choices are in `docs/DECISIONS.md`.

## License

MIT, see `LICENSE`.
