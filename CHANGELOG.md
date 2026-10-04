# Changelog

## 0.4.0

- **Smoother dragging**: the edge stays under the finger (within a few pixels) for the whole drag. The position is computed from an exact model of the track layout instead of from the cards being resized, and the two cards next to the dragged edge drop their minimum size while dragging, so a slot can be squeezed down to `min-gap`.
- `min-gap` defaults to **5 minutes** (was 30): slots can be very short.

## 0.3.0

- The weekly view defaults to the **week bar with the selected day in focus** (`week-layout="tabs"`): tap a day on the bar to see and edit only that day. The seven-row view is still available with `week-layout="rows"`.
- `week="off"` with a weekly value now shows one day (the `day` option, else the selected day, else today) as a daily schedule, instead of an empty, locked timeline.
- Fix: the `value` and `day` attributes present in the HTML at first connection were ignored.

## 0.2.0

- Weekly schedules are shown as **seven horizontal rows** (one 24 h row per day, hour axis on top), each editable in place: drag the edges, tap a band to edit it, tap the day to select it for Add / Copy. New option `week-layout` (`rows` default, `tabs` = previous one-day-at-a-time view).
- Dragging an edge **pushes the neighbouring slots** instead of stopping at the minimum gap (`push`, default on; also for the keyboard). New core function `pushBoundary`.
- The dragged edge follows the finger exactly: the pointer is mapped through the real card sizes (short slots are drawn larger than their share, which used to make the edge drift).

## 0.1.0 (unreleased)

First version.

- `<day-rhythm>` web component: daily and weekly schedules, draggable edges and seam, unlimited slots, week bar (top/bottom/off/auto, prev/next, copy-to), saved days and presets, editor dialog with per-model fields.
- One JSON `config` (attribute, property or `<script type="application/json">` child), per-part `classes`, `render="light"`, `::part()`, CSS variables.
- Themes: organic (light/dark), neutral, flat, none. Locales: `en`, `it`. 12h/24h.
- Pure core (`dayrhythm/core`, ESM + CJS) with conformance vectors.
- React wrapper (`dayrhythm/react`), hand-written types, JSON Schema.
- 16 packs, demo pages, playground and pack gallery.
- The library has no Apply button, staged/live mode or dirty tracking: it emits `input` and `change`, the host app decides when to save.
