# Changelog

## 0.7.3

- Fix (narrow screens): on a vertical track a slot's name no longer breaks one letter per line ("E v e n i n g"). Name and setting stay on one line and end with an ellipsis when short of room; below 24rem the setting's summary is hidden (it is in the editor).

## 0.7.2

- Fix (touch): scrolling a phone page no longer moves the slots it crosses, and edges still drag at once. 0.7.1 made every edge drag at once, so on a vertical track a scroll that started on an edge moved it. Now the page scrolls across edges; the grip in the middle of an edge drags at once; elsewhere on a vertical track's edge a still press (`touch-hold`, 300 ms again) grabs it; horizontal tracks drag at once and a vertical swipe scrolls the page.

## 0.7.1

- Fix (touch): edges move at once again when dragged with a finger. Since 0.6.0 an edge waited for a 300 ms still press, and a normal swipe on it neither dragged it nor scrolled the page, so on phones dragging looked broken. `touch-hold` now defaults to `0`; set it (e.g. `300`) to bring the hold back.
- Fix (touch): no more blue tap-highlight square on Android when tapping the dial or other parts of the component.

## 0.7.0

- **JSON themes.** `theme` takes a theme object as well as a name: `{ id, light, dark?, shape?, skin? }`, plain JSON (also as the `theme` attribute). Registered themes (`themes.register(theme)`) are used by name. The built-in themes use the same format internally.
- **Eight themes** in the optional `dayrhythm/themes` set (`dist/dayrhythm-themes.min.js` registers them on `DayRhythm.themes`): Dose, Blueprint, Console, Terminal, Ultraviolet, Brutal, Garden, Sticker. Gallery: `site/themes.html`.
- Fix: a `value` inside a config set after the element was connected (`el.config = { ...pack, value }`) was ignored, so the slots kept the default models ("Unknown"). It now replaces the value, as at connection. The home page demo showed this.
- Fix: a message variable passed but empty (a slot without a model) showed the raw placeholder, `Unknown ({id})`; it now shows `?`.
- Site: new look for every page (designed with Hallmark) and a themes gallery, `site/themes.html`.

## 0.6.0

- **Touch: hold to drag** (`touch-hold`, default 300 ms). On touch screens an edge moves only after a short still press; a tap or a swipe that lands on an edge no longer drags it. `touch-hold="0"` restores the immediate drag.
- Fix: setting `clockOffset` (e.g. a periodic clock sync with the device) rebuilt the whole component and closed an open editor dialog. It now only moves the now line. Setting any other option to the value it already has no longer rebuilds either.

## 0.5.0

- **Dial layout** (`layout="dial"`): the day as a 24-hour ring. Slots are arcs, knobs on the ring move slot starts (drag or keyboard, with the same push/min-gap/lock rules as the strip), tap an arc to edit it; the centre shows the time, the active slot and the time left. Example: `examples/dial.html`.
- Internals: the renderer is split into `src/ui/render/` modules and the slot editing commands moved to `src/ui/commands.js`; public API unchanged.
- Build scripts run on Windows (`npx` through npm's CLI).

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
