---
name: dayrhythm
description: Turn a plain-language use case into a valid dayrhythm config JSON for the <day-rhythm> web component (daily or weekly time-slot schedules). Use when the user asks to create, design or edit a daily/weekly schedule, time-slot program, scenes, setpoints, opening hours, timer, or a heating / irrigation / lighting / blinds / feeder / pump program, or mentions <day-rhythm>, dayrhythm, a schedule config or a slot editor. Also in Italian - programma giornaliero o settimanale, fasce orarie, scene, setpoint, orari di apertura, irrigazione, riscaldamento, luci, tapparelle, programmazione oraria, crea/modifica la configurazione.
---

# dayrhythm config author

Goal: from a use case ("irrigazione orto, 3 zone, settimanale") produce ONE complete, validated config JSON for `<day-rhythm>` plus an HTML embed snippet.

A config is: `models` (what a slot can set), optional `fields` (per-slot values), `value` (the starting schedule, daily array or `{ "week": {...} }`), `presets`, `theme`, `locale`. The component handles time, dragging, the week and a11y; you only describe meaning.

Read when needed (paths relative to this skill folder):
- `references/config-cheatsheet.md` - keys, field types, daily vs weekly values, limits
- `references/icons.md` - how to pick icon names from the catalog
- `references/themes.md` - theme ids and custom theme objects
- `references/examples.md` - 3 compact examples from real packs

## Workflow

### 1. Understand the use case
Extract: the device/domain; daily or weekly (different days differ -> weekly; same every day -> daily); what a slot SETS (the knobs: temperature, brightness, zone, portion...) with units and sane ranges; the labels; the language (`en` default, `it` if the user writes Italian or asks for it).
Ask AT MOST ONE short question, and only if the domain itself is unclear. Otherwise assume sensible defaults and state them in one line at the end.

### 2. Start from the closest pack
Packs live in `packs/*.json` of the dayrhythm package (`node_modules/dayrhythm/packs/` or the repo): thermostat, irrigation, blinds, light-scenes, screen-filter, office-hours, pet-feeder, pool-pump, water-heater, ventilation, ev-charging, grow-light, garden-lighting, aquarium-reef, presence-simulation, sleep-wake. If one is close, read its JSON and adapt it (rename ids/labels, change ranges, add or drop models) instead of writing from scratch. Packs use emoji icons: replace them with catalog names (step 3).

### 3. Design models
- One model per distinct behaviour the user can pick for a slot: `{ id, label, icon, preview, ... }`.
- `id`: lowercase kebab-case, stable, unique. `label`: short (1-2 words) in the config language.
- Always include an "off / nothing happens" model with `"off": true` when the domain has an idle state (it renders striped, is excluded from shuffle). Preview colour is not needed for it.
- **Icon by NAME** (`"icon": "droplets"`), chosen from `icons/catalog.json` by meaning; see `references/icons.md`. One icon per distinct meaning, never reuse one for two models. No emoji unless the user asks for them.
- **Fixed model** = `defaults` only (e.g. comfort -> `{ "temp": 21 }`). **Editable model** = `fields` + `defaults` (one "Custom/Manual" model per domain is usual). A plain model has neither.
- **Fields**: `{ key, type, label, default, min, max, step, unit }` with type `range` (slider; most knobs), `number`, `select` (needs `options: [{value,label}]`), `toggle`, `color`, `text`. Always set `min`, `max`, `step`, `unit`, `default`; the default must be inside the range / among the options.
- `summary`: template under the label, `{key}` per value: `"{temp} °C"`, `"{portion} · {type}"`. Only use keys that exist in `fields`/`defaults`.
- **Preview colours** (`preview`, any CSS colour) must be distinguishable side by side and read on light AND dark: semantic hue (cold blue, warm orange, hot red-orange, calm green, water cyan), mid lightness (roughly 45-70%). For a continuous knob use `previewScale: { field, min, max, from, to }` instead.
- Weekly extras: `days: ["sat","sun"]` limits a model to those weekdays; `when: {from,to}` limits it to start times.

### 4. Presets and the default value
- 2-4 realistic presets: `{ "id", "label", "slots": [{ "time": "HH:MM", "model": "<id>" }] }`. Each preset is one DAY (also in weekly mode). Include a neutral one ("Holiday"/"Vacanza" = one slot at `00:00` with the idle model) when it makes sense.
- `value` is the starting schedule: a daily array, or `{ "week": { "mon": [...], ... "sun": [...] } }`. Slots need only `time` + `model` (+ `values` to override defaults, `label`). Times `HH:MM`, unique per day, at least `minGap` apart (cyclic in daily mode). Make `value` the most common preset, not an empty day.
- Set `minGap`/`snap` to the domain granularity (watering 15, heating 30, lights 5). Weekly: set `"week": "top"`. Weekly days may be `[]` (the previous day's last slot carries on).

### 5. Pick the theme
Map the look the user describes to a theme id (full list and custom objects: `references/themes.md`):
warm glowing dashboard -> `glow`; retro / arcade / game -> `arcade`; technical / blueprint / engineering -> `blueprint`; minimal / clean / neutral -> `neutral`; playful / stickers / fun -> `sticker`; dark atmospheric / night -> `lumen`, `midnight` or `kiln`; garden / editorial / nature -> `garden`; health / routine / pharmacy -> `dose`; terminal / dev / hacker -> `terminal`; bold poster / loud -> `brutal`; violet / modern -> `ultraviolet`; amber console / ops panel -> `console`; xaqua default look -> `organic`. No preference: omit `theme` (default `organic`). Themes other than `organic|neutral|flat` need the themes bundle in the page (step 6). A fully custom look = a theme object (see themes.md).

### 6. Output
Give, in this order:
1. The complete config JSON (one fenced `json` block, 2-space indent, `$schema` first). Save it to a file (e.g. `dayrhythm.config.json`) so it can be validated.
2. The embed snippet:
```html
<day-rhythm>
  <script type="application/json">{ ...the config... }</script>
</day-rhythm>
<script src="https://cdn.jsdelivr.net/npm/dayrhythm/dist/dayrhythm.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dayrhythm/dist/dayrhythm-themes.min.js"></script><!-- only if theme is not organic/neutral/flat -->
<script src="https://cdn.jsdelivr.net/npm/dayrhythm/dist/dayrhythm-icons.min.js"></script><!-- only if icons are names -->
<script>
  document.querySelector('day-rhythm').addEventListener('change', (e) => console.log(e.detail.resolved)); // save this
</script>
```
Load the themes/icons bundles AFTER `dayrhythm.min.js` (they register into it). With npm instead: `import 'dayrhythm'; import { themes } from 'dayrhythm'; import set from 'dayrhythm/themes'; import { icons } from 'dayrhythm/icons';` and register as described in `references/themes.md` / `references/icons.md`. `e.detail.resolved` is the schedule with refs expanded (what a server should consume).
3. One line listing assumptions (units, ranges, language, theme choice).

### 7. Validate and fix
```
node <skill-dir>/scripts/validate.mjs dayrhythm.config.json
```
It runs the package JSON Schema, then checks: duplicate ids, unknown models in slots/presets, field ranges and defaults, `{placeholders}` in templates, `minGap`, preview colours, icon names against `icons/catalog.json`. Exit code 1 + plain-language errors -> fix the config and rerun until `OK`. Warnings are advisory; fix them when cheap. The script looks for the package in `node_modules/dayrhythm`, then the repo it ships in; `--catalog path` points at a catalog explicitly (the CDN copy `https://cdn.jsdelivr.net/npm/dayrhythm/icons/catalog.json` works after saving it locally). If node is unavailable, re-read the cheatsheet and check by hand.

## Worked example: "irrigazione orto, 3 zone, settimanale"

Reasoning: weekly (water Mon/Wed/Fri, light Saturday) -> `week: "top"`; Italian -> `locale: "it"` and Italian labels; slot sets zone (select, 3 zones + all) and flow (range 10-100 %); models: off, irrigation (full flow), drip (low flow); nature feel -> `garden`; `minGap` 15; presets Estate / Mezza stagione / Vacanza; icons by name: `power` (off), `droplets`, `sprout`. Based on `packs/irrigation.json`. Saved in full as `references/example-irrigation.json` (validated).

```json
{
  "$schema": "https://unpkg.com/dayrhythm/schema/config.schema.json",
  "week": "top", "locale": "it", "theme": "garden", "minGap": 15, "snap": 5,
  "value": { "week": {
    "mon": [{ "time": "05:30", "model": "water", "values": { "zone": "all", "flow": 100 } }, { "time": "06:30", "model": "off" }],
    "tue": [],
    "wed": [{ "time": "05:30", "model": "water", "values": { "zone": "all", "flow": 100 } }, { "time": "06:30", "model": "off" }],
    "thu": [],
    "fri": [{ "time": "05:30", "model": "water", "values": { "zone": "all", "flow": 100 } }, { "time": "06:30", "model": "off" }],
    "sat": [{ "time": "06:00", "model": "drip", "values": { "zone": "z2", "flow": 40 } }, { "time": "07:00", "model": "off" }],
    "sun": [] } },
  "models": [
    { "id": "off", "label": "Spento", "icon": "power", "off": true },
    { "id": "water", "label": "Irrigazione", "icon": "droplets", "preview": "#3aa6d8",
      "defaults": { "zone": "all", "flow": 100 }, "summary": "{zone} · {flow}",
      "fields": [
        { "key": "zone", "type": "select", "label": "Zona", "default": "all",
          "options": [{ "value": "all", "label": "Tutte" }, { "value": "z1", "label": "Zona 1 · aiuole" },
                      { "value": "z2", "label": "Zona 2 · pomodori" }, { "value": "z3", "label": "Zona 3 · insalate" }] },
        { "key": "flow", "type": "range", "label": "Portata", "min": 10, "max": 100, "step": 10, "unit": "%", "default": 100 } ] },
    { "id": "drip", "label": "Goccia a goccia", "icon": "sprout", "preview": "#6aa84f",
      "defaults": { "zone": "z2", "flow": 40 }, "summary": "{zone} · {flow}",
      "fields": [
        { "key": "zone", "type": "select", "label": "Zona", "default": "z2",
          "options": [{ "value": "z1", "label": "Zona 1 · aiuole" }, { "value": "z2", "label": "Zona 2 · pomodori" }, { "value": "z3", "label": "Zona 3 · insalate" }] },
        { "key": "flow", "type": "range", "label": "Portata", "min": 10, "max": 60, "step": 10, "unit": "%", "default": 40 } ] }
  ],
  "presets": [
    { "id": "estate", "label": "Estate", "slots": [{ "time": "05:30", "model": "water" }, { "time": "06:30", "model": "off" }, { "time": "21:00", "model": "water" }, { "time": "21:45", "model": "off" }] },
    { "id": "mezza-stagione", "label": "Mezza stagione", "slots": [{ "time": "06:30", "model": "drip" }, { "time": "07:30", "model": "off" }] },
    { "id": "vacanza", "label": "Vacanza", "slots": [{ "time": "00:00", "model": "off" }] }
  ]
}
```

## Rules of thumb
- Output must be strict JSON: no comments, no trailing commas, no functions. Function-valued options (`preview` as function, `renderers`, `clock`, `storage` adapters) are JS-only: never emit them.
- Do not invent keys: the schema rejects unknown top-level keys. Per-model extras go in `meta`.
- Labels and field names are plain strings in the config language; for a second language add `messages: { "it": { "model.water": "Irrigazione", "field.flow": "Portata", "preset.estate": "Estate" } }` (see cheatsheet) instead of duplicating the config.
- Editing an existing config: read it, change only what was asked, keep ids stable (ids are on the wire in saved schedules), validate.
- Do not add `credits` settings or storage/load endpoints unless asked.
