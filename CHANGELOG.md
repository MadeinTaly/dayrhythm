# Changelog

## 0.1.0 (unreleased)

First version.

- `<day-rhythm>` web component: daily and weekly schedules, draggable edges and seam, unlimited slots, week bar (top/bottom/off/auto, prev/next, copy-to), saved days and presets, editor dialog with per-model fields.
- One JSON `config` (attribute, property or `<script type="application/json">` child), per-part `classes`, `render="light"`, `::part()`, CSS variables.
- Themes: organic (light/dark), neutral, flat, none. Locales: `en`, `it`. 12h/24h.
- Pure core (`dayrhythm/core`, ESM + CJS) with conformance vectors.
- React wrapper (`dayrhythm/react`), hand-written types, JSON Schema.
- 16 packs, demo pages, playground and pack gallery.
- The library has no Apply button, staged/live mode or dirty tracking: it emits `input` and `change`, the host app decides when to save.
