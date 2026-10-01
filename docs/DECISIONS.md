# Decisions

Choices made while implementing `docs/API.md` (v0.3). Later entries win.

## Owner decisions

1. **No Apply button in the library** (overrides the spec). Removed: apply bar, staged/live `mode`, `apply-bar`, the `apply` event and `waitUntil` on it, declarative `apply` endpoint, `dirty`/`dirtychange`, `markClean`/`revert`/`setStatus`/`apply()`, `apply-extra` slot, `--dr-apply-*` variables, their i18n keys and types. The component emits `input` and `change`; the host owns saving. `daysave`/`daydelete` keep `waitUntil` (saved-day storage). The playground and every example show a host-side Apply button outside the component. `docs/API.md` was updated (rev 0.3).
2. Weekday linked to a saved day: editing detaches it (copy-on-write); the saved day is unchanged.
3. Empty weekday carries on the previous slot.
4. Date exceptions/holidays and transitions are out of v1.
5. A daily array under a week bar expands to seven days on the first weekly edit.
6. Donation link: README, site and playground only. In the component, `credits: true` (default) and `"minimal"` show only "Made with dayrhythm"; the extra value `"support"` adds the donation link.
7. Pack field ranges are illustrative.
8. (0.2) The week is shown as seven horizontal rows by default (`week-layout="rows"`); the tab view stays as `tabs`. Resizing must be easy: an edge follows the finger (pointer mapped through the real card geometry, so minimum card sizes no longer skew it) and pushes the neighbours instead of stopping (`push`, on by default).
9. (0.3) The default weekly view is again the week bar with one day in focus (`week-layout="tabs"`): tap a day on the bar to see and edit only that day. The seven rows stay available as `week-layout="rows"`. `week="off"` reduces a weekly value to one day instead of rendering empty.

## Implementation choices and deviations

- **Bundle size**: the element bundle is above the 20 KB target and above the 26 KB "hard" limit (about 29.6 KB gzip vs 20 KB target / 26 KB hard limit; core 4.0 KB vs 3 KB; react 1.7 KB vs 1.5 KB; packs 1.2-1.5 KB each, all within 2 KB; `npm run size`). The feature set (weekly, seam drag, dialogs, fields, two locales, four themes, storage) did not fit the budget; `size-check` only fails with `--strict`. Reducing it is future work (split locales/themes, trim CSS).
- **Test vectors** are grouped in `suites` (`{ suites: [{ name, slots|week, days?, cases }] }`) instead of one top-level `slots`/`cases`, to hold several scenarios. An extra `moves.json` covers `moveBoundary` (incl. seam) and `addSlotAt`. Case `at` can be `{ iso, utcOffsetMinutes|timeZone }`.
- **DOM tests**: none in the repo (they would need jsdom/linkedom). The element was smoke-tested manually with linkedom outside the repo; the pure UI parts (config, i18n, layout, models, fields) are tested in Node.
- **Rendering** rebuilds the track on structural changes instead of keyed card reuse. Dragging only touches `flex` values of the affected pieces.
- **Slots with an unparseable `time`** are dropped on load with an `error` event (`source: 'load'`) and a console warning; min-gap violations and unknown models are kept.
- **Messages** accept flat `{key: string}` or per-locale `{ it: {key: string} }` (packs use the latter). Extra keys: `loading`, `loadFailed`, `retry`, `presetFailed`, `model`, `preset.<id>`, `opt.<field>.<value>`.
- **Field type `text`** added (needed by the office-hours pack). Extra CSS variable `--dr-radius-dialog`.
- **Props** `add`, `remove`, `randomize` exist only as config keys and attributes (they clash with DOM/spec methods). `el.exportConfig()` returns the app-supplied layers, not the built-in defaults.
- **CSS nesting** is used by the base skin (evergreen browsers).
- Not implemented: `presetsArea` renderer, `IntersectionObserver` pause of the now-line timer (it pauses on `document.hidden`), `packages/ha-card` (phase 3), Playwright UI tests, `tsc --checkJs`. In `render="light"` mode, React `children` slots are unsupported.
- `package.json` is `private: true` (no publish); the orchestrator removes it when publishing. `dist/` and `site/vendor/` are generated but committed so CDN-from-GitHub and Pages work as is.
