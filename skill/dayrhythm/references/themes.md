# Themes

Set `"theme": "<id>"`. `organic` (default), `neutral`, `flat` and `none` are built in. The others live in `themes/index.js` (`dist/dayrhythm-themes.min.js`, a script tag that registers them all) and must be loaded in the page. Unknown id = falls back to the default look.

Register with npm instead of the script tag:
```js
import { themes } from 'dayrhythm'; import set from 'dayrhythm/themes';
Object.values(set).forEach((t) => themes.register(t));
```
Fonts are named with system fallbacks; add the web fonts to the page if wanted. All themes follow light/dark (`colorScheme: auto`) unless they are dark-only.

| id | Look | Use when |
|---|---|---|
| `organic` | xaqua default: green-teal, rounded asymmetric blobs, pill buttons | no preference, friendly consumer UI |
| `neutral` | system fonts, grey, blue accent, thin borders | minimal, clean, embed in any app |
| `flat` | square corners, solid tints, strong focus ring | accessibility first, plain admin UI |
| `none` | headless, layout only | you style it yourself with `--dr-*` / `classes` |
| `dose` | warm paper, tinted plastic slots, pharmacy-label mono times, one green | health, routine, medication, habits |
| `glow` | warm glowing dashboard | smart-home panel, lights, ambient |
| `arcade` | gold and oxblood on wine black, pixel/arcade type | retro, game-like, kiosks |
| `lumen` | dark atmospheric, luminous slots | lighting scenes, night dashboards |
| `midnight` | deep dark night palette | dark-only apps, bedrooms, TV |
| `kiln` | dark, warm ember tones | heating, ovens, hot things |
| `blueprint` | prussian-blue sheet, white line ink, square double keylines, mono measurements (dark) | technical, engineering, industrial |
| `console` | paper by day, graphite by night, one amber signal, legible mono times | ops panels, device control |
| `terminal` | near-black green cast, phosphor ink, monospace (dark) | developer tools, servers, hacker feel |
| `ultraviolet` | lavender or violet-black, hairline pills, saturated violet | modern, creative, music |
| `brutal` | poster white, heavy black rules, boxed cells, acid yellow | bold, loud, editorial posters |
| `garden` | oat paper, deep green ink, book serif for slot names, clay warnings | gardens, nature, editorial calm |
| `sticker` | warm off-white, die-cut white borders, hard ink shadows, hot pink | playful, kids, fun |

(The ids glow, arcade, lumen, midnight and kiln may be added to the package after this skill was written; if the id is not in `themes/index.js` or the validator warns, pick the closest listed one.)

Mapping hints: "caldo/accogliente" -> glow or kiln; "scuro/notte" -> midnight or lumen; "serio/tecnico" -> blueprint or console; "retro/gioco" -> arcade; "minimale" -> neutral; "giardino" -> garden; "divertente" -> sticker; "salute" -> dose.

## Custom theme object

For a look no id covers, put an object in `theme` (plain JSON, colours are any CSS colour):
```json
"theme": {
  "id": "harbor",
  "light": { "bg": "#f4f7fa", "surface": "#ffffff", "surface-soft": "#e8eef4", "ink": "#12202e", "muted": "#5b6b7a",
             "accent": "#0b6fa4", "accent-soft": "#cfe6f3", "accent-ink": "#ffffff", "now": "#d9482b", "focus": "#0b6fa4",
             "danger": "#b3261e", "border": "#cfd9e2", "shadow": "none", "overlay": "rgba(10,20,30,.45)" },
  "dark":  { "bg": "#0d1620", "surface": "#142231", "surface-soft": "#1b2d40", "ink": "#e8f0f7", "muted": "#9db0c2",
             "accent": "#5bb4e5", "accent-soft": "#1f4a66", "accent-ink": "#08121b", "now": "#ff7a5c", "focus": "#5bb4e5",
             "danger": "#ff8a80", "border": "#2a4056", "shadow": "none", "overlay": "rgba(0,0,0,.65)" },
  "shape": { "radius-panel": "12px", "radius-card": "10px", "radius-chip": "999px", "radius-input": "8px", "radius-button": "8px",
             "font": "\"Inter\",system-ui,sans-serif", "tint-opacity": ".4" },
  "skin":  { ".dr-track .dr-slot": "border:1px solid var(--dr-slot-color)" }
}
```
- `light` is required; `dark` optional (omit for a single-scheme theme; add `"scheme": "dark"` at top level for a dark-only theme and put the dark colours in `light`).
- Colour keys: `bg surface surface-soft ink muted accent accent-soft accent-ink now focus danger border shadow overlay`. They become `--dr-<key>`.
- `shape` keys: `radius-panel radius-dialog radius-card radius-card-h radius-chip radius-input radius-button radius-spectrum radius-tab font tint-opacity` (and other `--dr-*` sizes).
- `skin`: `{ "<css selector>": "<declarations>" }`. Use `.dr-track .dr-slot`-style selectors (one class more specific than bare `.dr-slot`). `--dr-slot-color` is the model colour on each slot.
- Keep contrast: `ink` on `surface` and `accent-ink` on `accent` at least 4.5:1.
- Without a theme object, tweak a built-in with page CSS: `day-rhythm { --dr-accent: #0b6fa4; }`.
