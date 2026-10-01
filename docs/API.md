# dayrhythm - Public API design (v0.3 draft)

A framework-agnostic, zero-dependency Web Component (`<day-rhythm>`) for editing a **24-hour cyclic schedule of time slots**, optionally across a **week** (7 days). A day is split into slots; each slot starts at a time and lasts until the next slot starts; the last slot wraps over midnight (in daily mode into the first slot; in weekly mode into the next day).

Repository: `github.com/MadeinTaly/dayrhythm` - licence MIT.

This document is the contract. The next step is implementation; anything not written here is not public API.

Generalizes two existing implementations (behaviours preserved unless listed in "Deliberate differences", 16.3):

- `xaqua-web/public/js/slotmachine.js` (aquarium lamp; cards sized by duration, draggable edges, model picker, presets, custom days, now line from lamp clock, apply bar).
- `overlay-dimmer/web/remote.html` (TV screen filter; adds custom per-slot values with sliders, add/remove/rename slot, saved named days, i18n EN/IT).

Revision 0.2 folds in the owner's product decisions (see 18.1): class-based styling (Tailwind friendly), draggable seam, weekly schedules in v1, no slot cap by default, a large set of model packs, credits + optional donation link, everything expressible as ONE JSON `config`, first-class React wrapper.

**Contents:** 1 Overview - 2 Quick start - 3 Data model - 4 Configuration - 5 Events - 6 Methods - 7 Pure helpers - 8 Models and fields - 9 Templating and styling hooks - 10 Theming - 11 i18n - 12 Accessibility, touch, performance - 13 Packaging, repo layout, packs - 14 Framework wrappers - 15 Versioning - 16 Migration - 17 Home Assistant card - 18 Decisions and open points - Appendix A types - Appendix B full config.

---

## 1. Overview

### Design principles

1. **Zero config works.** `<day-rhythm>` alone renders a valid on/off day, `en` strings, organic theme. Every feature is a toggle with a documented default.
2. **The app owns meaning, the library owns interaction.** The library knows time, slots, week, dragging, dialogs. It does not know what a slot *means*: the app supplies **models** and receives plain JSON back.
3. **One JSON object configures everything.** All options, models, presets, messages, classes, endpoints are keys of a single `config` (attribute, property, or `<script type="application/json">` child). Functions are allowed **only as optional overrides in JS**; every function-valued option has a declarative JSON equivalent (section 4.4).
4. **Slots are self-contained JSON.** An emitted slot carries its resolved `values`, so a server/TV needs no model table. Unknown extra properties on a slot survive a round trip.
5. **Storage and transport are optional.** The library can call your endpoints declaratively (`load`, `storage`), or just emit events. Either way it never owns your data.
6. **Never destroy incoming data.** Loading a value with a min-gap violation or an unknown model id renders it (marked invalid/unknown) and preserves it on output.
7. **Pure core, thin element.** All time/slot/week logic lives in DOM-free pure functions (`dayrhythm/core`), used by the element and importable by Node servers. A normative algorithm plus JSON test vectors (7.6) let non-JS ports (the Java TV app, Python) stay in sync.
8. **Styled like a Tailwind component.** Ready-made look by default, and every part accepts extra classes through `config.classes`; `::part()` and CSS variables remain available.

### Terminology

- **Slot**: `{ time, model, label?, values?, id? }`. Starts at `time`, ends at the next slot's `time`.
- **Model**: app-defined kind of slot setting (id, label, icon, preview, default values, optional editable fields).
- **Day**: an ordered list of slots. **Week**: seven days keyed `mon..sun`, each a list of slots or a reference to a saved day.
- **Preset**: read-only app-provided day template. **Saved day**: user-created day persisted by the app.
- **Axis / origin**: the timeline unrolled from its origin. **Seam**: the edge where the last slot wraps into the first (daily mode).

---

## 2. Quick start

### 2.1 Three lines

```html
<day-rhythm id="d"></day-rhythm>
<script type="module" src="https://cdn.jsdelivr.net/npm/dayrhythm"></script>
<script>d.addEventListener('change', e => myState = e.detail.value);  // your app decides when and how to save</script>
```

Defaults: models `on` / `off`, value `[{time:'07:00',model:'on'},{time:'22:00',model:'off'}]`, organic theme, auto orientation, add/remove/rename on, now line on, no week bar (daily), credits on, no slot limit. Listeners can be attached before the element upgrades; read `d.value` only after `ready`.

Classic `<script>`, single file:

```html
<script src="https://cdn.jsdelivr.net/npm/dayrhythm/dist/dayrhythm.min.js"></script>
```

Defines `<day-rhythm>` and a global `DayRhythm` (element class, core helpers, `defaults`, `locales`, `packs` index).

### 2.2 No JavaScript at all (JSON config + declarative endpoints)

```html
<day-rhythm>
  <script type="application/json">
  {
    "theme": "neutral", "locale": "en",
    "models": [
      { "id": "eco",     "label": "Eco",     "defaults": { "temp": 17 }, "preview": "#6d8fd6", "summary": "{temp} °C" },
      { "id": "comfort", "label": "Comfort", "defaults": { "temp": 21 }, "preview": "#e59a4b", "summary": "{temp} °C" }
    ],
    "load":  { "url": "/api/schedule" }
  }
  </script>
</day-rhythm>
```

Same thing as an attribute: `<day-rhythm config='{"theme":"neutral", ...}'>`, or from JS: `el.config = {...}`.

### 2.3 Full JS example (thermostat, using a pack)

```html
<day-rhythm id="heat" name="heating"></day-rhythm>
<script type="module">
  import 'dayrhythm';
  import thermostat from 'dayrhythm/packs/thermostat';
  import { localStorageAdapter } from 'dayrhythm/storage';

  const heat = document.getElementById('heat');
  heat.config = { ...thermostat, week: 'top', minGap: 30, snap: 5, maxSlots: 8 };  // packs are plain config objects
  heat.storage = localStorageAdapter('heating-days');                               // function-valued override
  heat.value = await (await fetch('/api/schedule')).json();                         // load: sets baseline, silent

  // the app owns saving: keep the value, send it from your own button
  heat.addEventListener('change', (e) => { pending = e.detail.resolved; });   // resolved = every weekday expanded, no refs
</script>
```

### 2.4 Weekly

```html
<day-rhythm week="top" first-day="auto"
  value='{"week":{"mon":[{"time":"06:30","model":"comfort"},{"time":"08:30","model":"eco"}],
                  "sat":[{"time":"09:00","model":"comfort"},{"time":"23:00","model":"eco"}]}}'></day-rhythm>
```

Days not listed are empty and carry over the previous day's last slot (3.4).

### 2.5 Tailwind

```html
<day-rhythm render="light" theme="none"
  config='{"classes":{"slot":"rounded-xl border shadow-sm","button":"rounded-full px-5 py-2","handle":"hover:bg-emerald-100"}}'></day-rhythm>
```

`render="light"` (no shadow root) is what lets page-level utility classes reach the parts. See 9.1.

### 2.6 React

```tsx
import { DayRhythm } from 'dayrhythm/react';
<DayRhythm config={cfg} value={slots} onChange={(v) => setSlots(v)} />
```

See 14.1.

---

## 3. Data model

### 3.1 Slot (the wire format)

```json
{ "id": "s3f9a1", "time": "07:30", "model": "comfort", "label": "Morning", "values": { "temp": 21 } }
```

| Field | Type | Req. | Rules |
|---|---|---|---|
| `time` | `"HH:MM"` | yes | 24 h, `00:00`..`23:59`, zero-padded, minute resolution (no seconds). Unique within a day. |
| `model` | string | yes | Model id. Unknown ids are kept and shown as "unknown model" (picker offers real models). |
| `label` | string | no | Free text, max 40 chars (`labelMax`). Absent: UI shows `Slot N` (i18n `slotDefault`). Never interpreted as HTML. |
| `values` | object | no | Resolved values of the model's fields/defaults (8.3). Emitted whenever the model has `defaults` or `fields`. |
| `id` | string | no on input | Stable identity, **unique across the whole week**. Generated if missing; always present on output. |
| `locked` | `true` or `("time"\|"remove"\|"label"\|"model")[]` | no | Per-slot restrictions. `true` = all four. |
| other keys | any JSON | no | Preserved verbatim. Reserved for future use: `transition`, `enabled`, `color`. |

Values are always JSON-serialisable; the library never emits functions, Dates or class instances.

### 3.2 Day (daily `value`)

An array of slots, **sorted by `time` ascending** on output. Input order is irrelevant. Invariants after normalisation: at least `minSlots` (default 1), at most `maxSlots` (default **unlimited**; in practice bounded by `1440 / minGap`), unique times, cyclic gaps >= `minGap` (violations on *input* are flagged by `validate()` and the `slot-invalid` part, not fixed).

Semantics (daily): slot *i* is active on `[time_i, time_{i+1})` (start inclusive, end exclusive); the last slot on `[time_n, time_1 + 24h)`. One slot covers 24 h.

**A plain slot array is always a valid daily value and is never wrapped or versioned.** Daily mode is fully backward compatible with v0.1.

### 3.3 Saved day and preset

```ts
type Day = { id: string; name: string; slots: Slot[] };
type Preset = { id: string; label: string; icon?: string; group?: string;
                slots?: Slot[] | (() => Slot[] | Promise<Slot[]>);     // JS forms
                slotsUrl?: string };                                     // JSON form: GET returns Slot[]
```

While an async preset resolves the chip shows `aria-busy`; failure emits `error`.

### 3.4 Week (weekly `value`)

```json
{ "week": {
    "mon": [ { "time": "06:30", "model": "comfort" }, { "time": "08:30", "model": "eco" } ],
    "tue": { "ref": "day-office" },
    "wed": [], "thu": [ ... ], "fri": [ ... ], "sat": [ ... ], "sun": [ ... ] } }
```

- **Discriminator**: a value is weekly iff it is a non-array object with a `week` key (`isWeek(v)`). An array is daily.
- Weekday keys are `mon tue wed thu fri sat sun` (ISO order, independent of the displayed first day). Missing key = empty day.
- Each entry is `Slot[]` (own slots) **or** `{ ref: <saved day id> }` (a reference resolved against `days`).
- **Carry-over semantics (weekly is not per-day cyclic)**: a day's slots run from their start to the next slot's start; the last slot of a day continues into the next day until *that* day's first slot. Before a day's first slot, the previous day's last slot is still active. An **empty day** simply continues the previous day's last slot all day. The week itself wraps: Sunday's last slot continues into Monday. A week with no slots at all has no active slot (`null`).
- In weekly mode the view uses `origin="midnight"` (forced): the head of the day is drawn as a **carry segment** (`slot-carry`, showing the previous day's last slot, non-editable; click selects that day).
- `minSlots` defaults to `0` per day in weekly mode (0 = "carry on").
- **Refs**: editing a day that is a ref **detaches** it (materialises a copy as its own slots, announces `detached`, `detail.detached = true`). Deleting a saved day detaches all refs to it in the current week (emits `change`, source `day`). A ref to an unknown id is preserved, drawn as an empty day with a warning badge, reported by `validate()` (`missing-ref`).
- **Resolved form**: `resolveWeek(week, days)` -> `{ mon: Slot[], ..., sun: Slot[] }` with refs expanded (the shape servers should consume). Events and the declarative `apply` body provide it as `resolved` (default body in weekly mode).

Daily and weekly share slot shape, models, presets, dialogs and drag rules; only the container differs.

---

## 4. Configuration

### 4.1 The `config` object

Every option below is a key of `config` (attribute name `kebab-case` -> config key `camelCase`: `min-gap` -> `minGap`). Attributes and properties exist for convenience and override config.

Ways to supply it (later wins; each is a separate layer, so replacing one does not touch the others):

1. Built-in defaults
2. `<script type="application/json">` **direct child** (parsed on connect and whenever `el.reloadConfig()` is called)
3. `config` attribute (JSON string, parsed on change)
4. `el.config = {...}` property (replaces this layer); `el.configure(partial)` deep-merges into it
5. Individual attributes (`theme="neutral"`)
6. Individual properties/setters (`el.theme = 'neutral'`, `el.models = [...]`)

Merge rules: plain objects merge deeply (`messages`, `classes`); arrays **replace** (`models`, `presets`, `days`). `config` may contain `value` (initial value only; later `el.value` wins). Invalid JSON: `console.error` once, `error` event (`source:'config'`), the layer is ignored. Unknown keys are ignored with a single `console.warn` in development builds.

Readers: `el.config` getter returns the effective merged config (functions included). `el.exportConfig({ includeValue?: boolean })` returns the **JSON-safe** subset (functions dropped, `undefined` removed) for saving/editors. A JSON Schema ships as `dayrhythm/config.schema.json` (`"$schema"` key accepted and ignored) for IDE completion.

**Function-valued options are optional overrides, JS only** (cannot appear in JSON): `renderers`, `modelFilter`, `clock`, `storage` (adapter object), `models[].preview/summary` (function forms), `Field.format` (function form), `presets[].slots` (function form). Each has the JSON alternative in 4.4.

### 4.2 Options

Types in `config` and as attributes (where it makes sense). **Toggle convention**: toggles accept `false`, `off`, `0` to disable; anything else including empty enables. Native-boolean attributes (presence = true) are `readonly`, `disabled`, `randomize`.

**Mode and data**

| Attribute / config key | Type | Default | Notes |
|---|---|---|---|
| `value` | `Slot[]` \| `WeekValue` (attr: JSON) | 2 default slots | Setting **replaces the baseline** (clean) and is **silent** (no events). |
| `name` | string | `""` | Form participation: FormData entry = JSON of `value` (form-associated). |
| `models` | `Model[]` | on/off | 8. Attribute: JSON. |
| `presets` | `Preset[]` | `[]` | Data, config/property only. |
| `days` | `Day[]` | `[]` | Saved days, config/property only. |
| `load` | `{ url, method?, headers?, credentials? }` | none | On connect: fetch and set `value` (baseline). GET by default; non-2xx or bad JSON -> `error` (`source:'load'`). |
| `storage` | `{ type:'local', key }` \| `{ type:'http', url, headers?, credentials? }` (JSON) or `DayStorage` (JS) | none | Saved days. `http`: `GET url` -> `Day[]`; `POST url` body `{name,slots}` -> `Day`; `DELETE url/{id}`. `local`: localStorage. |

**Behaviour**

| Attribute / config key | Type | Default | Notes |
|---|---|---|---|
| `min-gap` | minutes | `30` | Minimum slot duration. |
| `snap` | minutes | `5` | Drag/keyboard granularity. Must divide 60. |
| `min-slots` | int | `1` daily, `0` weekly (per day) | Remove disabled at the bound. |
| `max-slots` | int \| `null` | `null` (**unlimited**) | Optional cap (per day in weekly). The track grows (min card size) instead of clipping when many slots exist. |
| `origin` | `first` \| `midnight` | `first` (daily); forced `midnight` in weekly | See 4.3. |
| `seam-drag` | toggle | on | The seam edge is draggable (4.3). |
| `push` | toggle | on | Dragging an edge into a neighbour pushes it along (kept `min-gap` apart) instead of stopping; see `pushBoundary` (7.2). Off = edges stop at `min-gap`. |
| `orientation` | `auto` \| `horizontal` \| `vertical` | `auto` | `auto` uses the **component's own width** (`ResizeObserver`): horizontal when >= `breakpoint`. |
| `breakpoint` | px | `640` | For `auto`. |
| `add`, `remove`, `rename`, `time-edit` | toggle | on | Editing features. |
| `show-presets` | toggle | on | Presets area (shown when `presets` non-empty). |
| `show-days` | toggle | on | Saved-days area (shown when `storage` set or a `daysave` listener exists). |
| `spectrum` | toggle | on | Preview strip. |
| `now-line` | toggle | on | Now line. In weekly mode only on today's day view. |
| `clock-offset` | minutes | `0` | Device clock = browser + offset. |
| `timezone` | IANA | browser | Zone for "now" and "today". Ignored if `clock` is set. |
| `time-format` | `24h` \| `12h` | `24h` | Display only; wire format stays `HH:MM`. |
| `editor` | `auto` \| `quick` \| `full` | `auto` | `quick`: model grid closes on pick (xaqua). `full`: dialog with time, name, model grid, fields, remove (overlay-dimmer). `auto`: `full` if rename/remove/time-edit/fields is active, else `quick`. |
| `randomize` | boolean | off | "Shuffle models" button. |
| `readonly` | boolean | off | No editing UI; cards remain focusable and announce content. |
| `disabled` | boolean | off | Inert, dimmed. |
| `label-max` | int | `40` | |

**Week** (see 3.4)

| Attribute / config key | Type | Default | Notes |
|---|---|---|---|
| `week` | `auto` \| `top` \| `bottom` \| `off` | `auto` | Week bar position. `auto` = `top` iff `value` is weekly, else no bar (daily mode). `off` = daily only: a weekly value is reduced to one day (the `day` option, else the selected day, else today) with a console warning. The week can always be disabled with `off`. |
| `week-layout` | `tabs` \| `rows` | `tabs` | Weekly view. `tabs`: the week bar (seven days with a colour preview) and, under it, only the selected day in focus; tap a day to switch (`week` picks the bar position). `rows`: the seven days stacked as horizontal 24 h rows (hour axis on top), every row editable in place (drag edges, tap a band to edit, tap the day to select it for Add / Copy); no tab bar and no spectrum. |
| `day` | `mon`..`sun` | today (device clock) | Selected weekday. Reflected. Also settable via `selectDay()`. |
| `first-day` | `auto` \| `mon`..`sun` | `auto` | Order of the 7 tabs. `auto`: `Intl.Locale(locale).getWeekInfo().firstDay` (fallback `weekInfo`, then `mon`). |
| `week-preview` | toggle | on | Tiny colour strip inside each day tab. |
| `week-copy` | toggle | on | "Copy to..." button (dialog with 7 day checkboxes and shortcuts: weekdays, weekend, all). |
| `link-days` | toggle | off | Choosing a saved day sets `{ref}` instead of copying its slots. |

**Look and language**

| Attribute / config key | Type | Default | Notes |
|---|---|---|---|
| `theme` | `organic` \| `neutral` \| `flat` \| `none` | `organic` | `none` = headless: only layout-critical CSS (10.3). |
| `color-scheme` | `auto` \| `light` \| `dark` | `auto` | `auto` follows `prefers-color-scheme`; apps with class-based dark set it from their toggle. |
| `locale` | string | `<html lang>`, else `en` | `it-IT` -> `it` -> `en`. |
| `messages` | `Record<string,string>` | `{}` | String overrides (11). |
| `classes` | `Record<PartKey, string \| string[]>` | `{}` | Extra CSS classes per part (9.1). |
| `render` | `shadow` \| `light` | `shadow` | `light` renders into the element itself (no shadow root): required for page utility classes such as Tailwind to reach parts. |
| `inherit-styles` | toggle | off | In `shadow` mode, adopt the document's same-origin stylesheets into the shadow root (an alternative to `light`). |
| `styles` | CSS string | none | Extra CSS added to the component (shadow root, or a scoped `<style>` in light mode). |
| `credits` | `true` \| `"minimal"` \| `false` | `true` | Footer: "Made with dayrhythm" (links to the repo) plus an optional "Support" link (donation page). `minimal`: credit only. `false`: nothing. Global default: `DayRhythm.defaults.credits`. Not mandatory (MIT). |

**Read-only properties**: `now` (device minutes), `nowDay` (device weekday), `resolvedOrientation`, `editing` (slot id or null), `weekMode` (boolean), `config` (effective), `static version`.

### 4.3 Origin, seam and dragging

- **Daily, `origin="first"`** (as in xaqua): the axis starts at the earliest slot; the wrapping slot is the last card. The edge at the axis start is the **seam** between the last and first slot and **is draggable** (part `handle handle-seam`, `seam-drag` toggle). Dragging moves the first slot's start (`moveBoundary`, clamped by the same rules as any edge). While dragging, the axis is **frozen** at its old origin and the wrap slot is drawn in two segments (tail at the head, `slot-tail`), so nothing jumps under the pointer; on release the axis re-anchors at the new first slot (one un-animated relayout). Crossing midnight (which changes slot order) is done via the editor time field.
- **Daily, `origin="midnight"`**: axis 00:00-24:00; a slot wrapping over midnight is two segments sharing one slot id (tail is `aria-hidden`, `slot-tail`). The edge between the tail and the first real slot is the seam handle.
- **Weekly**: always `midnight` axis; the head segment is the carry segment (`slot-carry`); there is **no seam** (the day boundary is fixed at 00:00), the first slot's start is an ordinary handle bounded below by 00:00.

### 4.4 JSON equivalents of function options

| JS override | JSON form |
|---|---|
| `model.preview: (values, model, slot) => css` | `"preview": "<css background>"` with `{key}` interpolation of values (`"hsl({hue} 70% 55%)"`), or `"previewScale": { "field": "temp", "min": 5, "max": 30, "from": "#6d8fd6", "to": "#e5533b" }` (colour interpolation in `oklab` via `color-mix`). |
| `model.summary: fn` | `"summary": "{temp} °C"` (`{key}` = value; a field's `unit`/`format` string is applied if `{key}` matches a field). |
| `Field.format: fn` | `"format": "{value} K"` |
| `modelFilter: fn` | `model.when`: `{ "from": "05:00", "to": "22:00" }` (may wrap midnight): the model is offered only for slots starting inside the window. xaqua day/night reels. Also `model.days: ["sat","sun"]` in weekly mode. |
| `preset.slots: fn` | `"slotsUrl": "/api/tropical/reef"` (GET, returns `Slot[]`) |
| `storage: DayStorage` | `{ "type": "http" \| "local", ... }` |
| `clock: fn` | `clockOffset` + `timezone` |
| `renderers` | model `icon` as text or `{ "src": "<url>" }` (image), `classes`, `styles`; (structure-level renderers stay JS only) |

---

## 5. Events

All events bubble and are `composed`. Names are lowercase without hyphens, like native events. `event.target.value` is the current value (array or week).

| Event | When | Cancelable | `detail` |
|---|---|---|---|
| `input` | Continuous edits: dragging an edge, moving a slider, typing a label. Coalesced to one per animation frame. | no | `ChangeDetail` |
| `change` | A committed edit: drag released, keyboard step, model picked, slider released, label blurred, slot added/removed, preset/day applied, copy-to, editing methods. | no | `ChangeDetail` |
| `dayview` | Selected weekday changed (tab, prev/next, carry click, `selectDay`). | no | `{ day: Weekday, previous: Weekday }` |
| `dayselect` | A preset chip or saved day chosen, **before** loading. `preventDefault()` cancels. | yes | `{ kind: 'preset'\|'day', id, slots, day?: Weekday }` |
| `daysave` | User confirmed "Save this day" with a name. | no | `{ name, slots, waitUntil(p) }` |
| `daydelete` | User confirmed delete of a saved day. | no | `{ day: Day, waitUntil(p) }` |
| `slotopen` / `slotclose` | Editor dialog opened/closed. | no | `{ id }` |
| `slotinvalid` | An edit was refused (also announced in the live region). | no | `{ reason: 'min-gap'\|'max-slots'\|'min-slots'\|'duplicate-time'\|'locked', id?, limit? }` |
| `error` | A preset/adapter/endpoint/config/render failure. | no | `{ source: 'preset'\|'storage'\|'load'\|'config'\|'render', error }` |
| `ready` | First render done. | no | `{}` |

```ts
type ChangeDetail = {
  value: Slot[] | WeekValue;      // as authored (weekly: refs kept as refs)
  resolved: Slot[] | ResolvedWeek;// daily: same as value; weekly: every day expanded
  previous: Slot[] | WeekValue;
  source: 'drag'|'keyboard'|'model'|'values'|'label'|'time'|'add'|'remove'|'preset'|'day'|'copy'|'randomize'|'api';
  id?: string;                    // slot touched
  day?: Weekday;                  // weekly: day edited
  detached?: boolean;             // weekly: the edit detached a {ref} day
};
```



**Load vs edit.** Setting `value`, `setValue()`, `setDay()` and `load` **load** state: silent. Every edit path (UI or `addSlot`, `removeSlot`, `updateSlot`, `moveSlot`, `copyDay`, `assignDay`, `randomize`) emits `change`. Presets/saved days chosen in the UI emit `change` (`preset`/`day`) and mark dirty, so the user previews before Apply.

### 5.1 Storage adapter (JS form)

```ts
interface DayStorage {
  list(): Promise<Day[]> | Day[];
  save(day: { name: string; slots: Slot[] }): Promise<Day> | Day;
  remove(id: string): Promise<void> | void;
}
```

After `daysave`/`daydelete` fire, the adapter is called and `days` refreshed. Without adapter the app handles the events and sets `days`. Ships `localStorageAdapter(key)` and `httpStorageAdapter(url, init?)` in `dayrhythm/storage` (the same code the JSON `storage` forms use). Save/delete UI is inline (dialog with name field, inline confirm), never `prompt()`/`confirm()`.

---

## 6. Methods

"Emits" = fires `change`.

| Method | Returns | Emits | Description |
|---|---|---|---|
| `addSlot(partial?, opts?: { day?, edit? })` | `Slot \| null` | yes (`add`) | Adds to the selected (or given) day. Without `time`: splits the **longest** slot at its midpoint (snapped), copying model and values. In an empty weekly day: creates a slot at 00:00 copying the carried slot. Returns `null` + `slotinvalid` if impossible. |
| `removeSlot(id)` | `boolean` | yes | Refused at `minSlots` or `locked`. |
| `updateSlot(id, patch)` | `Slot \| null` | yes (`api`) | Shallow-merge. `model` change resets `values` to the new model's defaults unless `patch.values` given. |
| `moveSlot(id, time)` | `boolean` | yes (`time`) | Same clamping as dragging. |
| `setValue(value)` | `void` | no | Load a daily array or week. Same as assigning `value`. |
| `setDay(slots, opts?)` | `void` | no | Daily: alias of `setValue`. Weekly: replaces the **selected** day's slots. |
| `getValue(opts?: { compact?, resolve? })` | value | - | `compact` omits default-equal `values` and ids. `resolve` (weekly) expands refs. |
| `getDay(day?)` | `Slot[]` | - | Slots of the selected/given weekday, refs resolved (daily: the day). |
| `getWeek(opts?: { resolve? })` | `WeekValue \| ResolvedWeek \| null` | - | `null` in daily mode. |
| `getSlot(id)` | `Slot \| null` | - | |
| `activeSlot(at?)` | `Slot \| null` | - | Active slot now (device clock) or at `at`. Weekly `at`: `Date` or `{ day, time }`. |
| `selectDay(day)` / `prevDay()` / `nextDay()` | `void` | `dayview` | Week navigation; prev/next cycle through the displayed order and wrap. |
| `copyDay(from, to, opts?: { newIds? })` | `boolean` | yes (`copy`) | `to`: `Weekday[]` or `'weekdays'\|'weekend'\|'all'` (the source is excluded). Slot ids are regenerated for copies (ids stay unique). |
| `assignDay(day, slotsOrRef)` | `boolean` | yes (`day`) | Set a weekday to slots or `{ ref }`. |
| `openEditor(id)` / `closeEditor()` / `focusSlot(id)` | `void` | - | |
| `syncClock(deviceTime)` | `void` | - | Computes `clockOffset` from `'HH:MM[:SS]'`, `Date` or minutes. Weekly: also accepts `{ day, time }`. |
| `validate()` | `Issue[]` | - | Includes `missing-ref`. |
| `randomize(filter?)` | `void` | yes | Random non-`off` model per slot of the selected day. |
| `configure(partial)` / `reloadConfig()` / `exportConfig(opts?)` | - | - | 4.1. |
| `static define(tag?)` | `void` | - | Register under another tag. |

---

## 7. Pure helpers (`dayrhythm/core`)

DOM-free, side-effect-free, no globals: Node, workers, Deno, Bun. Immutable. Also `DayRhythm.core.*` in the IIFE build. Ships ESM and CJS (`dayrhythm-core.cjs`, so CommonJS servers such as xaqua-web's Express need no `import()`).

### 7.1 Time

```ts
parseTime(s: string): number                 // 'HH:MM' -> 0..1439; throws RangeError
tryParseTime(s: unknown): number | null
formatTime(min: number, opts?: { format?: '24h'|'12h' }): string   // wraps mod 1440
minutesOf(at: string | number | Date, opts?: ClockOpts): number    // float, [0,1440)
weekdayOf(at: Date, opts?: ClockOpts): Weekday
type ClockOpts = { utcOffsetMinutes?: number; timeZone?: string }
```

`Date` with no options = the runtime's local time. `utcOffsetMinutes` (e.g. `+120`) or `timeZone` interprets the instant in the device's zone (replaces xaqua's `tzOffsetMinutes` plumbing).

### 7.2 Daily slots

```ts
sortSlots(slots): Slot[]
normalizeDay(slots, opts?: { ids?: boolean }): Slot[]
slotRanges(slots): Array<{ slot; index; start; end; duration }>     // end may exceed 1440 (wrapping slot)
activeSlotAt(slots: Slot[], at, opts?: ClockOpts): ActiveInfo | null
nextChange(slots, at, opts?): { slot; index; inMinutes } | null
validateDay(slots, opts?: { minGap?; models? }): Issue[]
resolveValues(slot, models): object | undefined
addSlotAt(slots, opts?: { time?; minGap?; snap?; maxSlots?; cyclic? }): { slots; added } | { error: InvalidReason }
removeSlotById(slots, id, opts?: { minSlots? }): Slot[] | { error: InvalidReason }
moveBoundary(slots, id, toMinutes, opts?: { snap?; minGap?; cyclic? }): { slots; time; clamped }
pushBoundary(slots, id, toMinutes, opts?: { snap?; minGap?; cyclic? }): { slots; time; minutes; clamped; pushed }
```

`moveBoundary`: the target is snapped, then clamped in the *clock day* to `[prev.time + minGap, next.time - minGap]`. With `cyclic: true` (daily, default): for the first slot `prev` is the last slot minus 1440 (lower bound `max(0, last.time + minGap - 1440)`), for the last slot `next` is the first slot plus 1440 (upper bound `min(1439, first.time + 1440 - minGap)`); this also governs the **seam handle**. With `cyclic: false` (weekly): the first slot's lower bound is 0 and the last slot's upper bound is 1439; no wrap terms. Dragging never reorders slots.

`pushBoundary` (used by drag and keyboard when `push` is on): like `moveBoundary`, but neighbours in the way are pushed so each stays `minGap` from the previous one; it stops only when the pushed chain hits the end of the day (00:00 / 23:59, or in a cyclic day the wrap bound `first.time + 1440 - minGap`) or a slot locked on `time`. In a cyclic day the first slot anchors the axis: it is never pushed, and dragging it pushes only forward. Bounds are snapped inward. `pushed` lists the ids moved besides `id`.

### 7.3 `activeSlotAt` (daily)

```ts
type ActiveInfo = { slot: Slot; index: number; start: number; end: number; elapsed: number; remaining: number };
```

`at`: minutes (float, reduced mod 1440), `'HH:MM'`/`'HH:MM:SS'`, or `Date`. `null` only for an empty day.

### 7.4 Weekly helpers

```ts
type Weekday = 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun';
const WEEKDAYS: readonly Weekday[];                               // ISO order
type DayRef = { ref: string };
type WeekValue = { week: Partial<Record<Weekday, Slot[] | DayRef>> };
type ResolvedWeek = Record<Weekday, Slot[]>;

isWeek(v: unknown): v is WeekValue
resolveWeek(week: WeekValue, days?: Day[]): ResolvedWeek           // unknown refs -> [] (reported by validateWeek)
withDay(week: WeekValue, day: Weekday, slotsOrRef: Slot[] | DayRef): WeekValue
copyDay(week: WeekValue, from: Weekday, to: Weekday[] | 'weekdays'|'weekend'|'all',
        opts?: { newIds?: boolean; days?: Day[] }): WeekValue      // pure "copy this day to..."; refs are copied as refs
weekRanges(week: WeekValue | ResolvedWeek, days?): Array<{ slot; day: Weekday; index; start: number; end: number; duration: number }>
    // start/end in absolute minutes from Monday 00:00, 0..10080; the last range's end wraps to Monday (end > 10080)
activeSlotAt(week: WeekValue | ResolvedWeek, at: Date | { day: Weekday; time: string | number },
             opts?: ClockOpts & { days?: Day[] }): WeekActiveInfo | null
type WeekActiveInfo = ActiveInfo & { day: Weekday; dayOffset: number }
    // day = the weekday the active slot belongs to (may be earlier than `at`'s day: carry-over); dayOffset = -k days back (0 = same day); index/start/end relative to that day
nextChange(week, at, opts?): { slot; day: Weekday; inMinutes: number } | null
validateWeek(week, opts?: { days?: Day[]; minGap?; models? }): Issue[]
orderedWeekdays(firstDay: Weekday): Weekday[]
firstDayOfWeek(locale: string): Weekday
```

`activeSlotAt` is overloaded on its first argument (array -> daily, week -> weekly), so callers of v0.1 are unaffected. `at` as `Date` derives the weekday with `weekdayOf(at, opts)`.

### 7.5 Normative algorithms

Daily:

```
activeSlotAt(slots, at):
  if slots empty: return null
  m = minutesOf(at) mod 1440
  sorted = sort(slots by start)
  candidate = last slot in sorted with start <= m      # start inclusive
  if none: candidate = last slot in sorted             # inside yesterday's wrapping slot
  return candidate
```

Weekly:

```
activeSlotAt(week, at):
  days = resolveWeek(week)
  t = index(at.day) * 1440 + minutesOf(at.time)         # index: mon=0 .. sun=6
  all = for each day d in 0..6, each slot s of days[d]: (d*1440 + start(s), s)   # sorted by absolute start
  if all empty: return null
  candidate = last entry in all with absStart <= t
  if none: candidate = last entry in all                # Sunday's (or last non-empty day's) slot wraps into Monday
  return candidate   (day = weekday of candidate; dayOffset = -(daysBetween(candidate day, at.day) mod 7))
```

### 7.6 Conformance vectors

Shipped as `test/vectors/active-slot.json` and `test/vectors/active-slot-week.json` (`{ slots|week, cases: [{ at, expect }] }`), used by the JS tests and by ports in other languages (the TV app is Java).

Daily, slots `07:00 a, 19:30 b, 23:00 c`: 00:00 -> c (wrap); 06:59 -> c; 07:00 -> a (inclusive); 19:29 -> a; 19:30 -> b; 22:59 -> b; 23:00 -> c; 23:59 -> c. Single slot: always active. Float `419.99` is still the previous slot.

Weekly, week `mon: [07:00 a, 20:00 b]`, `tue: []`, `wed: [08:00 c]`, others empty: mon 06:59 -> c (nothing starts at or before it, so the week wraps to the last entry, wed's c: `day: wed`, `dayOffset: -5`); mon 07:00 -> a; mon 20:00 -> b; tue 12:00 -> b (empty day carries); wed 07:59 -> b; wed 08:00 -> c; sun 23:59 -> c; empty week -> `null`.

---

## 8. Models and fields

### 8.1 Model

```ts
interface Model {
  id: string;                                   // required, unique, stable (goes on the wire)
  label?: string;                               // default: messages['model.<id>'] else id
  icon?: string | { src: string };              // text/glyph, or an image URL. Never HTML.
  preview?: string;                             // CSS <background>, {key} interpolation of values   (JSON form)
  previewScale?: { field: string; min: number; max: number; from: string; to: string };
  off?: boolean;                                // striped "nothing happens" rendering; excluded from randomize
  defaults?: Record<string, unknown>;
  fields?: Field[];                             // makes the model editable per slot
  summary?: string;                             // "{temp} °C" template shown under the label   (JSON form)
  group?: string; hint?: string;
  when?: { from: string; to: string };          // offered only for slots whose start is in the window (may wrap midnight)
  days?: Weekday[];                             // weekly: offered only on these weekdays
  classes?: string | string[];                  // extra classes on this model's cards/tiles
  meta?: unknown;                               // opaque, passed to renderers/filters
  // JS-only override forms:
  //   preview?: (values, model, slot) => string;  summary?: (values, model, slot) => string
}
```

- **Fixed model** (`defaults`, no `fields`): stores `values = defaults`.
- **Editable model** (`fields`): shows the field editor in the slot dialog.
- **Plain model**: `values` omitted.

`preview`/`summary` are evaluated at render and drag-commit time, never per pointer move.

### 8.2 Field

```ts
interface Field {
  key: string;
  type: 'range' | 'number' | 'select' | 'toggle' | 'color';
  label?: string; default?: unknown;            // default required for a well-defined new slot
  min?: number; max?: number; step?: number; unit?: string;
  format?: string;                              // "{value} K"  (JS override: (v) => string)
  options?: Array<{ value: string | number; label: string }>;   // select
  accent?: string;                              // CSS colour -> --dr-field-accent
}
```

Range renders a native `<input type=range>` with an output; `input` while dragging, `change` on release. Values are coerced to number, clamped to `[min,max]`, stepped; invalid input falls back to `default`. Exotic controls use `renderers.field`.

### 8.3 Values lifecycle

- New slot / model change: `values = { ...fieldDefaults, ...model.defaults }` (undefined for plain models).
- Emitted slots always carry **fully resolved** `values` (snapshot); stored days keep their numbers if the app later edits defaults; `resolveValues` refreshes.
- Unknown keys in `values` are preserved. Changing model A -> B carries no values over. `addSlot()` clones the source slot including values.

### 8.4 Model packs

Every pack is a config object (section 13.3). Example (screen filter, from overlay-dimmer):

```js
{ id: 'custom', label: 'Custom', defaults: { red: 20, bright: 40, temp: 1100 },
  fields: [
    { key: 'red',    label: 'Red tint',    type: 'range', min: 0,    max: 100,  step: 5,   unit: '%', accent: '#b57520' },
    { key: 'bright', label: 'Brightness',  type: 'range', min: 5,    max: 100,  step: 5,   unit: '%', accent: '#328466' },
    { key: 'temp',   label: 'Temperature', type: 'range', min: 1000, max: 4000, step: 100, format: '{value} K' } ],
  previewScale: { field: 'bright', min: 5, max: 100, from: '#1b1b1b', to: '#cdbfa8' } }
```

---

## 9. Templating and styling hooks

### 9.1 Styling like a Tailwind component

The default look is complete out of the box (10). To restyle, every part accepts **extra classes through configuration**, purely additive:

```json
{ "classes": { "slot": "rounded-xl shadow", "slotActive": "ring-2 ring-emerald-500",
               "button": "rounded-full", "weekTabSelected": "bg-emerald-100" } }
```

Rules:
- The key is the part name in camelCase (`slot-active` -> `slotActive`, `week-tab-selected` -> `weekTabSelected`); the full list is the part table in 10.2 (each part has a matching key). Value: space-separated string or string array.
- Classes are **added** to the part element (`classList.add`); state keys (`slotActive`, `weekTabSelected`, `modelOptionSelected`...) are applied only while the state holds. `classes.button` applies to all buttons, then the specific key (`buttonPrimary`, `applyButton`) on top.
- Per-model classes: `model.classes` on that model's cards and tiles.
- Nothing is removed: to drop the built-in look set `theme: "none"` (headless: only layout-critical CSS remains, e.g. flex sizing, positioning, handle hit areas; these live in a separate `structure` rule set that no theme or option disables).
- `::part()` (shadow mode) and `--dr-*` variables keep working alongside classes. Every part element also carries `data-part="<part-name>"` for selectors in light mode.

**Making page utility classes reach the parts.** Tailwind utilities are page-level CSS and cannot cross a shadow root. Two supported options:
1. **`render="light"`** (recommended for Tailwind): no shadow root; the component's CSS is injected once into `document.head` as `<style data-dayrhythm>`, all inside `@layer theme, base, dayrhythm, components, utilities;` (order compatible with Tailwind v4, so utilities always win) and scoped with `:where(day-rhythm)` (zero specificity). Named `<slot>`s (9.3) are emulated: children with a `slot="..."` attribute are relocated into the region. Dialogs still use `<dialog>`. Style isolation is lost by design.
2. **`inherit-styles`** in shadow mode: the document's same-origin stylesheets are adopted into the shadow root (kept in sync with a `MutationObserver` on `<head>`; cross-origin sheets are skipped with a warning). Costs memory per instance; use only if you need shadow isolation for the rest.

Tailwind's class scanner must see the strings: put `classes` in a source file it scans (JS/TS/HTML), or add the JSON file with `@source`.

### 9.2 Layers of customisation

1. **Data and config** (covers ~80%): `model.icon/preview/summary/fields`, `messages`, `classes`, `theme`, CSS variables. Fully JSON.
2. **Render callbacks (`renderers`, JS only)**: for structure inside repeated regions (each card, tile, field).
3. **Named slots + `::part()` + `styles`**: for singleton regions and pure styling.

Rejected: `{{ }}` light-DOM templates (mini template engine, XSS surface, new syntax); per-item named slots (page must mirror internal state); subclassing (turns internals into API); HTML-string renderers by default (XSS).

### 9.3 Renderer contract

```ts
type Rendered = string | Node | { html: string } | null | undefined;
//  string -> text node (safe); Node -> inserted as is; { html } -> explicit innerHTML opt-in; null -> default (partial overrides)

interface Renderers {
  slotContent?(ctx: SlotCtx): Rendered;
  slotLabel?(ctx: SlotCtx): Rendered;
  modelIcon?(ctx: SlotCtx): Rendered;
  modelOption?(ctx: ModelCtx): Rendered;
  field?(ctx: FieldCtx): Rendered;            // must call ctx.set(value[, commit])
  preset?(ctx: { preset: Preset; busy: boolean }): Rendered;
  presetsArea?(ctx: PresetsCtx): Rendered;
  weekTab?(ctx: { day: Weekday; label: string; slots: Slot[]; selected: boolean; today: boolean; linked?: Day }): Rendered;
}

interface SlotCtx {
  slot: Slot; model: Model; values: object | undefined; index: number; count: number;
  start: string; end: string; duration: number; day?: Weekday;
  active: boolean; invalid: boolean; readonly: boolean;
  t(key: string, vars?: object): string; preview: string;
}
```

Rules: called on **structural changes only**, never during a drag or per frame; cards keyed by slot id and reused; elements with `data-dr="time"`, `"start"`, `"end"` in the output are updated live while dragging; a throwing renderer is caught, reported (`error`, `source:'render'`) and the default is used; returned nodes are owned by the library.

### 9.4 Light-DOM slots (singleton regions)

| Slot name | Placement |
|---|---|
| `header` | Above presets/timeline. |
| `toolbar` | In the presets/actions row, after built-in buttons. |
| `week-extra` | In the week bar, after the copy button. |
| `footer` | Below the timeline, above credits. |
| `editor-extra` | Bottom of the slot dialog (one instance; use `slotopen` to update). |
| `empty` | Shown when a read-only day has no slots. |

### 9.5 Example: overlay-dimmer icon, xaqua forecast icon

```js
dimmer.styles = `.od-screen{display:inline-block;width:1.9rem;height:1.25rem;border:2px solid var(--dr-ink);border-radius:.3rem}`;
dimmer.renderers = { modelIcon: ({ model, preview }) => {
  const s = document.createElement('span'); s.className = 'od-screen';
  s.style.background = model.off ? 'var(--dr-off-pattern)' : preview; return s; } };

lamp.renderers = { modelIcon: ({ model, slot }) =>
  model.id === 'auto' ? model.icon + (forecastEmoji(slot.time) || '') : null };
```

---

## 10. Theming

### 10.1 CSS custom properties

Public variables are **never set by the library on `:host`** (or on the element in light mode); each is consumed as `var(--dr-x, <theme default>)`, so any ancestor rule or `day-rhythm { --dr-x: ... }` beats the built-in theme. Dark mode: define the variables under your own `.dark` selector.

| Group | Variables |
|---|---|
| Surfaces | `--dr-bg`, `--dr-surface`, `--dr-surface-soft`, `--dr-overlay` |
| Text | `--dr-ink`, `--dr-muted`, `--dr-accent-ink` |
| Accent | `--dr-accent`, `--dr-accent-soft`, `--dr-focus`, `--dr-danger` |
| Lines | `--dr-border`, `--dr-shadow` |
| Now line | `--dr-now` (`#d97761`), `--dr-now-width` (`2px`) |
| Shape | `--dr-radius-panel`, `--dr-radius-card`, `--dr-radius-card-h`, `--dr-radius-chip`, `--dr-radius-input`, `--dr-radius-button`, `--dr-radius-spectrum`, `--dr-radius-tab` |
| Size | `--dr-track-length` (vertical `max(70vh, 34rem)` as minimum length), `--dr-track-thickness` (horizontal `18rem`), `--dr-card-min` (`52px`), `--dr-gap` (`0.4rem`), `--dr-pad`, `--dr-handle-size` (`1.1rem`), `--dr-icon-size` (`1.35rem`), `--dr-spectrum-height` (`3.5rem`), `--dr-tap` (`44px`), `--dr-week-height` |
| Effects | `--dr-tint-opacity` (`0.25`), `--dr-off-pattern`, `--dr-field-accent`, `--dr-carry-opacity` (`0.55`), `--dr-duration` (`.12s`; `0s` under reduced motion) |
| Type | `--dr-font`, `--dr-font-size` (all sizes in `em` of it) |

### 10.2 Parts (and `classes` keys)

Stateful parts carry an extra part token (`::part(slot-active)`), because `::part()` cannot combine with attribute selectors. The `classes` key is the camelCase of the part name.

| Part | Element / states |
|---|---|
| `root`, `header`, `toolbar`, `footer` | regions |
| `week-bar`, `week-prev`, `week-next`, `week-copy` | week bar and its buttons |
| `week-tab` (`week-tab-selected`, `week-tab-today`, `week-tab-linked`, `week-tab-empty`), `week-tab-preview` | day tabs (`role="tab"`) |
| `presets`, `presets-group`, `presets-label`, `preset` (`preset-busy`), `preset-delete`, `preset-save` | presets/days area |
| `spectrum`, `spectrum-segment` | preview strip |
| `track` (`track-horizontal`/`track-vertical`) | card container |
| `slot` (`slot-active`, `slot-selected`, `slot-invalid`, `slot-locked`, `slot-tail`, `slot-carry`) | a card |
| `slot-tint`, `slot-content`, `slot-time`, `slot-label`, `slot-icon`, `slot-model`, `slot-summary` | card internals |
| `handle` (`handle-seam`), `handle-grip`, `handle-time` | edge between cards |
| `now-line`, `now-badge` | red line and its label |
| `add` | add-slot button |
| `dialog`, `dialog-header`, `dialog-title`, `dialog-body`, `dialog-actions` | dialogs (editor, picker, save, copy-to) |
| `field`, `field-label`, `field-value`, `field-input` | field editor |
| `model-grid`, `model-option` (`model-option-selected`), `model-icon`, `model-label` | picker |
| `input`, `button`, `button-primary`, `button-danger` | generic controls |
| `credits`, `credits-link`, `credits-donate` | footer |

### 10.3 Built-in themes

- **`organic`** (default): xaqua look. Asymmetric radii (`28px 28px 12px 28px` panels, `36px 36px 36px 12px` editor, rounded-top cards in horizontal), pill chips/buttons, blob spectrum strip. Light = xaqua `--app-*` (`#fbfefb`, `#e2f0e9`, `#163e38`, `#57716b`, `#146b59`, `#cbded4`); dark = xaqua dark (`#193730`, `#23453c`, `#edf7ef`, `#b0c8bb`, `#a6dfc5`, `#38574b`).
- **`neutral`**: system fonts, 8px radii, grey palette, blue accent (`#2563eb` / `#60a5fa` dark), thin borders, no shadow.
- **`flat`**: square corners, no card borders, solid tints, high-contrast focus ring; base for `forced-colors`.
- **`none`**: headless. Only the `structure` rules (layout, positioning, hit areas, `<dialog>` behaviour). No colours, radii, fonts; pair with `classes`.

All honour `prefers-reduced-motion`, `forced-colors`, `color-scheme`. A theme is a CSS-only addition.

### 10.4 Mapping an existing design system

```css
day-rhythm {
  --dr-surface: var(--app-surface);  --dr-surface-soft: var(--app-surface-soft);
  --dr-ink: var(--app-ink);          --dr-muted: var(--app-muted);
  --dr-accent: var(--app-accent);    --dr-border: var(--app-border);
}
```

---

## 11. i18n

Built-in: `en`, `it`. Resolution per string: `config.messages` -> registered locale (`xx-YY` -> `xx`) -> `en`. Interpolation `{name}`; plurals via `_one`/`_other` suffix and `Intl.PluralRules`. Weekday and month names come from `Intl.DateTimeFormat(locale)`, not from keys. Time display honours `timeFormat`.

```js
import { locales } from 'dayrhythm';
locales.register('fr', { add: 'Ajouter' });      // partial ok
el.messages = { add: 'Add period', nowLabel: 'Lamp time' };
```

Models/fields translate via their own `label` or `messages['model.<id>']`, `messages['field.<key>']` (win when present). Messages are plain strings, therefore JSON-configurable.

### Keys (all overridable)

| Key | en |
|---|---|
| `title` | Daily schedule (aria-label) |
| `titleWeek` | Weekly schedule |
| `presetsLabel` / `daysLabel` | Presets / My days |
| `saveDay` / `saveDayTitle` | Save this day / Save day |
| `dayName` / `dayNamePlaceholder` | Day name / e.g. Summer |
| `daySaved` / `deleteDay` / `deleteDayConfirm` | Day saved / Delete day / Delete "{name}"? |
| `confirm` / `cancel` / `close` / `done` | Confirm / Cancel / Close / Done |
| `add` / `remove` / `randomize` | Add slot / Remove slot / Shuffle models |
| `slotDefault` / `slotName` / `slotTime` | Slot {n} / Slot name / Start time |
| `slotStartOf` / `slotHandleHint` | Start of {name} / Arrow keys move by {snap} minutes |
| `seamHandle` | Start of the day cycle ({time}) |
| `slotAria` | {name}, {start} to {end}, {model} |
| `changeModel` / `pickModel` / `unknownModel` | Change setting / Setting for {name} / Unknown ({id}) |
| `nowLabel` / `nowAria` / `spectrumAria` | Now / Current time {time} / Preview of the day |
| `weekLabel` | Week |
| `prevDay` / `nextDay` | Previous day / Next day |
| `goToDay` | Go to {day} |
| `dayView` | Showing {day} (live region) |
| `weekTabAria` | {day}: {summary} |
| `copyDayTo` / `copyDayTitle` | Copy to... / Copy {day} to |
| `copyWeekdays` / `copyWeekend` / `copyAll` | Weekdays / Weekend / All days |
| `copyDone` | Copied to {days} |
| `carryFrom` | Continues from {day} |
| `linkedTo` / `detached` | Linked to "{name}" / {day} is no longer linked to "{name}" |
| `err.minGap` / `err.maxSlots` / `err.minSlots` | Slots must last at least {minutes} minutes / At most {max} slots / At least {min} slot is required |
| `err.duplicateTime` / `err.locked` / `err.timeFormat` / `err.missingRef` | Another slot already starts at {time} / This slot is locked / Enter a time as HH:MM / Saved day not found |
| `moved` / `added` / `removed` | {name} now starts at {time} / Slot added / Slot removed |
| `credits` | Made with dayrhythm |
| `donate` | Support the project |
| `empty` | No slots |

---

## 12. Accessibility, touch, performance

### 12.1 Accessibility

- Host `role="group"`, `aria-label` = `title`/`titleWeek`. Track `role="list"`, cards `role="listitem"` with `aria-label` (`slotAria`), `aria-current="true"` on the slot active now.
- **Drag handle** (including seam): `role="slider"`, `tabindex=0`, `aria-orientation`, `aria-valuemin/max` = legal bounds in minutes, `aria-valuenow`, `aria-valuetext` = formatted time, `aria-label` = `slotStartOf` (seam: `seamHandle`). Keys: arrows +-`snap`; `Shift`+arrows or `PageUp/PageDown` +-60; `Home/End` to bounds. Refusals announce the reason.
- **Week bar**: `role="tablist"` of `role="tab"` (roving tabindex, arrows/Home/End move and select, `aria-selected`, `aria-current="date"` on today); the timeline is the `tabpanel` (`aria-labelledby` = selected tab). Prev/next are buttons with `prevDay`/`nextDay` labels; selection changes are announced (`dayView`). The carry segment is a button (`goToDay`).
- **No drag-only features**: time field in the editor, add/remove buttons, model buttons, copy-to dialog.
- **Dialogs** use native `<dialog>` + `showModal()`: focus trap, `Esc`, inert background. Focus goes to the first control; on close returns to the invoking control looked up by slot id (cards are reused). Backdrop click closes.
- Live region (`role="status"`, polite): moves (throttled 400 ms), add/remove, copy, day view, detach, refusals.
- Picker tiles: `role="radiogroup"`/`role="radio"` with arrow navigation, `aria-checked`.
- Colour is never the sole carrier: label, time range, icon, summary; `off` uses a pattern; now line has `nowAria`.
- Contrast: built-in themes meet WCAG AA (text) and 3:1 (UI components), light and dark; `forced-colors` maps accent to `Highlight`, borders to `CanvasText`.
- Targets >= `--dr-tap` (44 px); `prefers-reduced-motion` disables transitions and dialog scale-in.

### 12.2 Touch and pointer

Pointer Events only, `setPointerCapture`, `touch-action: none` on handles only (page scrolls on cards). `pointercancel` restores the pre-drag value. While dragging, a time bubble (`handle-time`) appears beside the handle so the finger does not hide the value. No long-press anywhere. Week tabs scroll horizontally when narrow (narrow weekday names below 420 px container width via container query).

### 12.3 Performance (no layout thrash)

- Card size is pure CSS: `flex: <duration> 1 0`; no pixel sizes set. The track's length is a **minimum** so many slots grow it rather than clip.
- On `pointerdown`: one `getBoundingClientRect()` of the track (cached until `ResizeObserver`). During `pointermove`: arithmetic only; writes batched in one `requestAnimationFrame` (`flex-grow` on the two neighbours, their time text, spectrum segments, `aria-value*`). No reads after writes in a frame.
- One delegated listener set on the track; cards reused by slot id (keyed reconciliation); weekly day switch reuses the same DOM.
- Now line via one CSS variable on the track, updated by a single timer aligned to the next minute; paused when `document.hidden`, disconnected, or off-screen (`IntersectionObserver`); no timer when `now-line` is off and nothing needs `active`.
- `contain: layout style` on the host; one constructed `CSSStyleSheet` shared by instances (fallback `<style>`).

---

## 13. Packaging, repo layout, packs

### 13.1 Requirements met

- **No build step to use it**: `src/` is plain ES2020 modules with explicit `.js` imports; CSS lives in JS template strings.
- **Single file for `<script>` use**: `dist/dayrhythm.min.js` (IIFE, global `DayRhythm`).
- **Size targets (min+gzip)**: core <= 3 KB; element bundle (element + core + weekly + `en` + `it` + 4 themes) <= 20 KB, hard CI limit 26 KB; `react` wrapper <= 1.5 KB; each pack <= 2 KB, not in the bundle. Locale `it` and themes are separate entries for tree shaking.
- **TypeScript**: hand-written `types/*.d.ts` (authoritative), source checked by `tsc --noEmit --checkJs`.
- **Runtime dependencies**: zero. Dev only: `esbuild`, `typescript`, Playwright, `node:test`. Peer (optional): `react >= 18` for `dayrhythm/react`.

### 13.2 Layout

```
dayrhythm/                          # github.com/MadeinTaly/dayrhythm
  package.json  LICENSE(MIT)  README.md  CHANGELOG.md
  docs/API.md
  src/
    index.js  element.js
    core/  index.js time.js slots.js active.js week.js validate.js
    ui/    render.js drag.js dialog.js fields.js presets.js week-bar.js clock.js a11y.js config.js
    i18n/  index.js en.js it.js
    styles/ structure.js base.js themes.js
    storage.js                      # local + http adapters
  react/  index.js  DayRhythm.js    # dayrhythm/react (no top-level DOM access)
  types/  index.d.ts core.d.ts storage.d.ts react.d.ts
  schema/ config.schema.json
  packs/                            # importable model packs (config objects), one file each
    index.js  light-scenes.js  aquarium-reef.js  screen-filter.js  thermostat.js  irrigation.js
    blinds.js  pool-pump.js  ev-charging.js  grow-light.js  office-hours.js  water-heater.js
    ventilation.js  pet-feeder.js  presence-simulation.js  garden-lighting.js  sleep-wake.js
  examples/                         # one demo page per pack + gallery + feature demos
    index.html                      # gallery: pack picker, theme/locale/mode switcher, live JSON config editor
    packs/<pack-id>.html            # minimal page per pack (CDN-free, imports ../../src)
    daily-minimal.html  weekly.html  tailwind.html  json-only.html  live-mode.html  react/ (Vite)
  dist/                             # generated, published to npm
    dayrhythm.js  dayrhythm.min.js  dayrhythm-core.js  dayrhythm-core.cjs
  test/  vectors/active-slot.json active-slot-week.json  core/*.test.js  ui/*.spec.js
  scripts/ build.mjs  size-check.mjs  packs-json.mjs   # emits packs/*.json (function-free) for non-JS consumers
  packages/ha-card/                 # phase 3
```

### 13.3 Packs

A pack is `export default { id, title, description, models, presets?, messages?, ...defaults }`: a valid partial `config` (JSON-serialisable; JS only for optional `preview` functions). Use: `el.config = pack`, or `el.config = mergeConfig(pack, mine)` (`mergeConfig` exported: deep merge, arrays replace). `dayrhythm/packs` exports `{ packs }` (id -> pack) and each pack is also importable by path (`dayrhythm/packs/thermostat`); `scripts/packs-json.mjs` emits function-free `.json` twins. Each pack has its demo page under `examples/packs/`. `messages` include `en` and `it` labels.

| Pack id | Use case | Models (ids) | Editable fields | Presets | Default mode |
|---|---|---|---|---|---|
| `light-scenes` | Smart lamp / mood lighting | `sunrise`, `day`, `sunset`, `evening`, `night`, `moonlight`, `off` | `brightness`, `kelvin` on `custom` | Standard, Early bird, Night owl | daily |
| `aquarium-reef` | Reef aquarium lamp (xaqua) | `dawn`, `morning`, `midday`, `afternoon`, `dusk`, `moon`, `off`, `storm` | `white`, `blue`, `power` on `custom` | Reef, FOWLR, Planted, Acclimation | daily |
| `screen-filter` | Warm/dim TV or monitor filter (overlay-dimmer) | `off`, `soft`, `evening`, `cinema`, `night`, `deep`, `custom` | `red`, `bright`, `temp` | Movie, Early, Late | daily |
| `thermostat` | Heating/cooling setpoints | `away`, `eco`, `comfort`, `boost`, `manual` | `temp` (5-30, 0.5) on `manual` | Office, Home all day, Holiday | weekly |
| `irrigation` | Garden watering | `off`, `water` | `zone` (select), `flow` (%) | Summer, Spring/Autumn | weekly |
| `blinds` | Shutters / blinds | `open`, `half`, `closed`, `tilt`, `sun-shade` | `position` (0-100), `tilt` (0-90) | Summer heat, Winter, Vacation | weekly |
| `pool-pump` | Pool filtration | `off`, `low`, `normal`, `boost` | `speed` (%) on `normal` | Summer, Winter, Solar-hours | daily |
| `ev-charging` | EV charging by tariff windows | `off`, `solar-only`, `cheap`, `fast`, `pause` | `current` (6-32 A), `limit` (% SoC) | Two-rate night, Three-rate F1/F2/F3, Solar | weekly |
| `grow-light` | Plant grow light | `off`, `seedling`, `vegetative`, `flowering`, `sunrise-ramp` | `intensity` (%), `red`/`blue` ratio | 18/6, 12/12, 16/8 | daily |
| `office-hours` | Opening hours / presence | `open`, `lunch`, `focus`, `closed`, `on-call` | `note` (text), `capacity` (number) | Standard, Summer, Retail | weekly |
| `water-heater` | Boiler / DHW | `off`, `eco`, `comfort`, `boost`, `anti-legionella` | `temp` (30-70) | Night tariff, Solar surplus | weekly |
| `ventilation` | Fan / VMC | `off`, `low`, `normal`, `boost`, `night-cool` | `speed` (%) | Bathroom, Kitchen, Summer night | daily |
| `pet-feeder` | Feeding schedule | `none`, `feed` | `portion` (g), `type` (select) | Twice daily, Three meals | daily |
| `presence-simulation` | Away lighting simulation | `dark`, `living`, `bedroom`, `random` | `rooms` (select) | Vacation | daily |
| `garden-lighting` | Outdoor lights | `off`, `path`, `party`, `security` | `brightness` | Dusk to dawn | daily |
| `sleep-wake` | Wind-down / wake ramps | `sleep`, `wind-down`, `wake-ramp`, `awake` | `volume`, `brightness` | School, Weekend | weekly |

The list is the initial set of 16; more are accepted as contributions. Every pack must ship: models with `icon` and preview colours, `en` + `it` messages, at least two presets, the demo page, and a test that `exportConfig` round-trips through the JSON Schema.

### 13.4 `exports`

```json
{
  ".":          { "types": "./types/index.d.ts",   "default": "./src/index.js" },
  "./element":  { "types": "./types/index.d.ts",   "default": "./src/element.js" },
  "./core":     { "types": "./types/core.d.ts",    "import": "./src/core/index.js", "require": "./dist/dayrhythm-core.cjs" },
  "./storage":  { "types": "./types/storage.d.ts", "default": "./src/storage.js" },
  "./react":    { "types": "./types/react.d.ts",   "default": "./react/index.js" },
  "./packs":    "./packs/index.js",
  "./packs/*":  "./packs/*.js",
  "./locales/*": "./src/i18n/*.js",
  "./config.schema.json": "./schema/config.schema.json",
  "./dist/*":   "./dist/*"
}
```

`unpkg`/`jsdelivr` fields point at `dist/dayrhythm.min.js`. `dayrhythm/element` exports the class without registering.

### 13.5 Browser support

Evergreen browsers (custom elements v1, shadow DOM, `<dialog>`, constructed stylesheets, `ResizeObserver`, Pointer Events, `ElementInternals` for form association - feature-detected, `Intl.Locale.getWeekInfo` optional with fallback). No polyfills.

### 13.6 Credits and donation

- README top section and the component footer credit: "Made with dayrhythm" links to `https://github.com/MadeinTaly/dayrhythm`.
- Next to it (default `credits: true`) a discreet "Support the project" link to `https://gt.1471995.xyz` (`donate` message, part `credits-donate`). Purely optional; both open with `target="_blank" rel="noopener"`. `credits: "minimal"` removes the donation link, `credits: false` removes everything. The library never makes network requests for this (plain links); MIT does not require attribution. README states the same and repeats the optional donation.

---

## 14. Framework wrappers

### 14.1 React (`dayrhythm/react`), first-class

```tsx
import { DayRhythm, useActiveSlot, type DayRhythmHandle } from 'dayrhythm/react';
import thermostat from 'dayrhythm/packs/thermostat';

function Heating() {
  const [value, setValue] = useState<Slot[] | WeekValue>(initial);
  const ref = useRef<DayRhythmHandle>(null);
  return (
    <DayRhythm
      ref={ref}
      config={thermostat}                       // one JSON object (memoise or hoist; compared by deep equality)
      value={value}                             // controlled; or defaultValue for uncontrolled
      onChange={(next, detail) => setValue(next)}
      classes={{ slot: 'rounded-xl shadow', button: 'rounded-full' }}
      renderers={{ modelIcon: ({ model }) => <MyIcon id={model.id} /> }}    // ReactNode allowed
      theme="neutral" locale="en" week="top" readOnly={false}
      className="my-schedule" style={{ maxWidth: 720 }}
    />
  );
}
```

Contract:
- Props: `config`, `value`/`defaultValue`, all `on*` events as `onChange(value, detail)`, `onInput`, `onDayView`, `onDaySave`, `onDayDelete`, `onDaySelect`, `onSlotInvalid`, `onError`, `onReady`; common options as direct props (`theme`, `locale`, `week`, `mode`, `readOnly`, `disabled`, `orientation`, `classes`, `messages`, `models`, `presets`, `days`, `storage`, `renderers`, `modelFilter`, `clock`); `className`, `style`, `id`, `children` (slotted content: `<div slot="header">`). Direct props override `config` keys (same precedence as 4.1).
- `ref` = `DayRhythmHandle`: the element with all methods of section 6 (`addSlot`, `copyDay`, ...).
- **Controlled value without loops**: the wrapper sets `el.value` only when the `value` prop is not deeply equal to the last emitted/pushed value. `el.value` is silent, so no echo events.
- **SSR-safe** (Next.js app router/Remix/Astro): the module touches no `window`/`document`/`customElements` at import time and carries `'use client'`. On the server it renders `<day-rhythm>` with only serialisable attributes (`theme`, `locale`, `week`, `readonly`, `className`, `style`) plus optional `fallback` children (skeleton) with no `config`/`value` serialised. On the client, an effect registers the element (`import('dayrhythm')` once) and applies config/value/handlers, so there is no hydration mismatch. Tag registration is idempotent.
- `renderers` may return `ReactNode`; the wrapper mounts it in a container node via a portal registry keyed by (region, slot id, day), cleaned on unmount. Plain `string`/`Node`/`{html}` still work.
- `useActiveSlot(value, { tickMs = 30000, clock })` returns the active slot now via core `activeSlotAt` (daily or weekly), for dashboards outside the editor.
- Types: full generics-free TS types re-exported (`Slot`, `WeekValue`, `Model`, `Field`, `Config`, `ChangeDetail`...). Works with React 18 and 19 (uses effects/refs rather than React 19 custom-element prop passing, so behaviour is identical).
- Peer dependency `react >= 18`; no other dependencies; not pulled in by `import 'dayrhythm'`.

### 14.2 Vue 3

```js
app.config.compilerOptions.isCustomElement = (t) => t === 'day-rhythm';   // vite: vue({ template: { compilerOptions: ... } })
```
```vue
<script setup>
import 'dayrhythm'; import thermostat from 'dayrhythm/packs/thermostat';
const value = ref(initial);
</script>
<template>
  <day-rhythm :config.prop="thermostat" :value.prop="value" week="top"
              @change="value = $event.detail.value" />
</template>
```
Use `.prop` (or `:value` on custom elements) to pass objects as properties. `v-model` equivalent: `:value.prop` + `@change`. Nuxt: wrap in `<ClientOnly>` or `defineNuxtPlugin` client-side import.

### 14.3 Svelte

```svelte
<script>
  import 'dayrhythm'; import thermostat from 'dayrhythm/packs/thermostat';
  let value = $state(initial);
</script>
<day-rhythm config={thermostat} {value} week="top"
            onchange={(e) => (value = e.detail.value)}></day-rhythm>
```
Svelte 5 sets known properties on custom elements; in Svelte 4 use `bind:this` and assign properties in `onMount`. SvelteKit: import the module only in the browser (`onMount(() => import('dayrhythm'))`).

### 14.4 Others

Angular: `CUSTOM_ELEMENTS_SCHEMA`, `[config]`/`[value]` bind as properties, `(change)` events. Solid: `prop:config`, `on:change`. Lit/vanilla: direct. Optional wrappers beyond React are community territory.

---

## 15. Versioning and evolution

- **SemVer.** `0.x` until both apps run on it in production; then `1.0.0`.
- **Public API surface** (breaking = major): tag name, attributes/config keys and semantics, properties, methods and signatures, event names and `detail` shapes, `classes` keys, `part` names, `--dr-*` names, i18n keys, slot and week wire formats, `core` exports, `exports` map, JSON Schema (removal/rename of keys), pack ids and model ids of shipped packs.
- **Minor**: new optional attributes/config keys/events/parts/classes keys/variables/i18n keys/themes/packs/field types; new optional `detail` fields; new optional slot fields; visual refinements of themes.
- **Patch**: fixes with no contract change.
- **Wire format**: daily = plain array (never wrapped). Weekly = `{ week }` envelope introduced in 0.2; unknown properties are preserved so additive changes need no version field. Any future envelope must accept the array and `{week}` forms.
- **Deprecation**: one minor with a single `console.warn` per session naming the replacement, removal at the next major.
- Conformance vectors are versioned with the library; changing them is a major.
- `DayRhythm.version` / `DayRhythmElement.version` expose the version.

---

## 16. Migration notes

### 16.1 xaqua-web (`slotmachine.js`, 565 lines -> ~50 lines of glue)

Server keeps `slotModels.js`, `composeSchedule`, the two-phase protocol and `/api/schedule/*`. The host page keeps its own Apply button and reacts to `change`.

```js
import 'dayrhythm';
const el = document.querySelector('day-rhythm');
const SM = window.__SM__;

el.config = {
  locale: 'it', editor: 'quick', rename: false, add: false, randomize: true,
  messages: { nowLabel: 'Ora lampada', title: 'Il ritmo della luce' },
  models: flattenReels(SM.models).map(m => ({            // reel -> model.when window replaces bandForTime duplication
    id: m.id, label: m.label, icon: m.emoji, off: m.type === 'off', when: reelWindow(m.reel), meta: { type: m.type },
    preview: colorPreview(m) })),
  presets: [...SM.presets.map(toPreset),
            { id: 'reef', label: 'Tropicale', slotsUrl: '/api/schedule/tropical/reef?format=slots' },
            { id: 'atoll', label: 'Atollo',    slotsUrl: '/api/schedule/tropical/atoll?format=slots' }],
  storage: { type: 'http', url: '/api/schedule/daypresets' },      // server adapts to {id,name,slots}
  load:  { url: '/api/schedule/reels?format=slots' },
};
el.renderers = { modelIcon: ({ model, slot }) => model.meta.type === 'auto' ? model.icon + (autoForecastEmoji(slot.time) || '') : null };  // JS-only override
el.syncClock((await (await fetch('/api/lampinfo')).json()).time);                                // replaces loadLampClock
```

Notes: `/api/schedule/compose` currently expects `{selection, depth}`; either the server accepts the new slot array (recommended, small mapper server-side) or a `change` listener maps client-side. `preview: colorPreview(m)` may need the JS function form since colour depends on the resolved lamp profile. Theme mapping block from 10.4. Suggestions strip goes into `slot="header"`. The wizard is dropped (16.3). Server: `getCurrentTransition`/`wledScheduler` use `require('dayrhythm/core').activeSlotAt(slots, new Date(), { utcOffsetMinutes })`. `schedule.css` `sm-*` rules are deleted.

### 16.2 overlay-dimmer (`remote.html` schedule section, ~330 lines -> ~40 lines of glue)

```js
el.config = { ...screenFilterPack, locale: lang, maxSlots: 12,
  load:  { url: '/api/schedule', /* server returns {slots} */ },
  storage: { type: 'http', url: '/api/days' } };          // or JS adapter mapping its {name, delete:true} protocol
el.renderers = { modelIcon: screenIconRenderer };          // 9.5; .od-screen CSS via el.styles
applyButton.onclick = () => api('/api/schedule', { enabled: true, slots: toWire(el.value) });   // host-side button
// toWire: s => ({ time, label, model, ...s.values, on: s.model !== 'off' });  fromWire is the inverse.
```

The TV app (Java) keeps its wire format: `toWire`/`fromWire` is the only adapter, and `test/vectors/active-slot.json` verifies its active-slot logic. `sched-on` stays in the host page next to its own Apply button. `confirm()`/`prompt()` are replaced by built-in dialogs. Tailwind `sm-*`/`od-screen` rules in `input.css` are deleted. As overlay-dimmer builds Tailwind, it may use `render="light"` + `classes` instead of theme variables.

### 16.3 Deliberate differences from the existing implementations

- No Apply bar, staged/live mode or dirty tracking in the library (owner decision, rev 0.3): the host app owns its Apply button.
- The seam is draggable (was not); daily drag clamping now accounts for the wrap across midnight (the old code ignored `last - first` gap across midnight).
- Unknown model ids are preserved and shown (was: replaced by the first model).
- Time edit field added (keyboard/mobile alternative; crossing midnight).
- Breakpoint uses component width (was viewport `matchMedia`).
- Picker tiles are a radiogroup (was `aria-pressed` buttons); dialogs are native `<dialog>`.
- Saved days UI: dialog for name; xaqua's multi-row wizard dropped (compose on the timeline, then "Save this day"). Slot labels never interpreted as HTML.
- No slot cap by default (overlay-dimmer used 12: set `maxSlots: 12`).

---

## 17. Home Assistant Lovelace card (phase 3, outline)

Separate package `packages/ha-card` (`dayrhythm-card`), bundles the IIFE (one file for HACS).

- `type: custom:dayrhythm-card`; wraps `<day-rhythm>` inside its own shadow root (works because styling is variable/part based).
- **Config is the same JSON `config`** expressed in YAML plus HA keys:
  ```yaml
  type: custom:dayrhythm-card
  entity: input_text.heating_schedule       # or a sensor/climate attribute holding the JSON value
  attribute: schedule
  write: { service: script.set_heating_schedule }   # called with { value, resolved }; or entity_service: input_text.set_value
  pack: thermostat                          # bundled pack id (16 packs), merged under the YAML
  week: top
  models: [ ... ]   # only the JSON subset: preview strings/previewScale, summary templates, when windows
  clock: { entity: sensor.device_time }     # -> syncClock
  ```
- Theming maps `--dr-*` to HA variables (`--card-background-color`, `--primary-text-color`, `--secondary-text-color`, `--primary-color`, `--divider-color`); language from `hass.locale.language`; first day from `hass.locale.first_weekday`.
- `set hass(h)` re-reads the entity and updates `value` unless the user is editing; the host calls `hass.callService` on `change`. `getConfigElement()` visual editor (entity picker, pack picker, models list), `getStubConfig()`, `getCardSize()`.
- Saved days via `hass.callWS` collection or the `local` adapter. Phases: 3a read/write one entity + packs, 3b visual editor, 3c saved days + HACS metadata.

---

## 18. Decisions and open points

### 18.1 Owner decisions applied (revision 0.2)

| # | Decision | Where |
|---|---|---|
| 1 | ~~Staged mode + Apply bar~~ removed in rev 0.3 (host app owns Apply). Tailwind-style styling: `classes` per part, plus `::part()` and variables. | 4.2, 5, 9.1, 10 |
| 2 | Seam (last->first) is draggable, with frozen-axis drag and `seam-drag` toggle. | 4.3, 7.2, 12.1 |
| 3 | Weekly schedules in v1: optional week bar (top/bottom/off), locale-aware first day, prev/next, per-day slots or saved-day refs, copy-to, weekly `activeSlotAt` with carry-over; daily stays a plain array. | 3.4, 4.2, 6, 7.4-7.6 |
| 4 | No slot limit by default; `maxSlots` still configurable. | 3.2, 4.2 |
| 5 | 16 model packs under `packs/` with demo pages under `examples/`. | 13.2, 13.3 |
| 6 | Repo `github.com/MadeinTaly/dayrhythm`, MIT; credits link to repo; optional donation link `https://gt.1471995.xyz` in README and credits area, removable. | 13.6, 4.2 |
| 7 | Everything configurable; ONE JSON `config` (attribute/property/script child) with JS-only function overrides and JSON equivalents; 12h/24h, flat theme, messages, renderers; first-class React wrapper; Vue/Svelte notes. | 4, 8, 14 |

### 18.2 Design corrections made while applying them

- The v0.1 toggles `presets` and `days` collided with the `presets`/`days` **data** keys once everything became a single config object. Renamed to `showPresets` / `showDays` (attributes `show-presets` / `show-days`).
- Weekly mode cannot reuse the per-day cyclic wrap: day boundaries are fixed at 00:00 and slots carry over between days, hence the carry segment and the no-seam rule.
- Tailwind classes cannot cross a shadow root, so `render="light"` (and `inherit-styles`) exist; a plain `classes` option alone would have been silently ineffective in shadow mode.

### 18.3 Remaining open points (need a product choice, defaults proposed)

1. **Editing a linked (ref) day**: proposed detach-on-edit (copy-on-write). Alternative: edit the saved day itself (affects every weekday that links it). Which is expected?
2. **Empty weekday** = carry on previous day's last slot (proposed). Alternative: an empty day means "off/no schedule". Which model for thermostats and irrigation?
3. **Date exceptions** (holidays, one-off overrides) are out of v1; confirm it is acceptable to defer.
4. **Transitions between slots** (xaqua `DeltaSeconds`, seconds-level effects): still only a reserved `transition` field, no UI in v1.
5. **`week: auto`** shows the bar iff the value is weekly. Should a `week="top"` with a daily array auto-convert the array into all seven days on first edit (proposed: yes, the array becomes the same day on all 7 weekdays, silently, at load)?
6. **Donation link visible by default** (`credits: true`): confirm this is desired over "credit only" default, since it appears in every embedding app.
7. **Pack scope**: 16 packs listed; confirm the field ranges (e.g. EV current 6-32 A, boiler 30-70 C) or mark them as illustrative.
8. **Locale coverage**: `en` and `it` at launch; keys in section 11 are frozen for 1.0.

---

## Appendix A - TypeScript types (condensed; authoritative copy in `types/index.d.ts`)

```ts
export interface Slot { id?: string; time: string; model: string; label?: string; values?: Record<string, unknown>;
  locked?: boolean | Array<'time' | 'remove' | 'label' | 'model'>; [extra: string]: unknown }
export interface Day { id: string; name: string; slots: Slot[] }
export type Weekday = 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun';
export type DayRef = { ref: string };
export type WeekValue = { week: Partial<Record<Weekday, Slot[] | DayRef>> };
export type ResolvedWeek = Record<Weekday, Slot[]>;
export type Value = Slot[] | WeekValue;

export interface Preset { id: string; label: string; icon?: string; group?: string;
  slots?: Slot[] | (() => Slot[] | Promise<Slot[]>); slotsUrl?: string }
export interface Model { id: string; label?: string; icon?: string | { src: string };
  preview?: string | ((v: any, m: Model, s: Slot) => string);
  previewScale?: { field: string; min: number; max: number; from: string; to: string };
  off?: boolean; defaults?: Record<string, unknown>; fields?: Field[];
  summary?: string | ((v: any, m: Model, s: Slot) => string); group?: string; hint?: string;
  when?: { from: string; to: string }; days?: Weekday[]; classes?: string | string[]; meta?: unknown }
export type Field =
  | { key: string; type: 'range' | 'number'; label?: string; default?: number; min?: number; max?: number; step?: number; unit?: string; format?: string | ((v: number) => string); accent?: string }
  | { key: string; type: 'select'; label?: string; default?: string | number; options: Array<{ value: string | number; label: string }>; accent?: string }
  | { key: string; type: 'toggle'; label?: string; default?: boolean; accent?: string }
  | { key: string; type: 'color'; label?: string; default?: string; accent?: string };

export type Http = { url: string; method?: string; headers?: Record<string, string>; credentials?: RequestCredentials };
export type PartKey = 'root' | 'header' | 'toolbar' | 'footer' | 'weekBar' | 'weekTab' | 'weekTabSelected' | 'slot' | 'slotActive' | /* ... one per part in 10.2 */ string;

export interface Config {
  $schema?: string; value?: Value; name?: string;
  models?: Model[]; presets?: Preset[]; days?: Day[];
  load?: Http;
  storage?: { type: 'local'; key: string } | ({ type: 'http' } & Http) | DayStorage;
  minGap?: number; snap?: number; minSlots?: number; maxSlots?: number | null;
  origin?: 'first' | 'midnight'; seamDrag?: boolean; orientation?: 'auto' | 'horizontal' | 'vertical'; breakpoint?: number;
  add?: boolean; remove?: boolean; rename?: boolean; timeEdit?: boolean; showPresets?: boolean; showDays?: boolean;
  spectrum?: boolean; nowLine?: boolean; clockOffset?: number; timezone?: string; timeFormat?: '24h' | '12h';
  editor?: 'auto' | 'quick' | 'full'; randomize?: boolean; readonly?: boolean; disabled?: boolean; labelMax?: number;
  week?: 'auto' | 'top' | 'bottom' | 'off'; day?: Weekday; firstDay?: 'auto' | Weekday;
  weekPreview?: boolean; weekCopy?: boolean; linkDays?: boolean;
  theme?: 'organic' | 'neutral' | 'flat' | 'none'; colorScheme?: 'auto' | 'light' | 'dark'; locale?: string;
  messages?: Record<string, string>; classes?: Partial<Record<PartKey, string | string[]>>;
  render?: 'shadow' | 'light'; inheritStyles?: boolean; styles?: string;
  credits?: boolean | 'minimal';
  // JS-only overrides (ignored by exportConfig):
  renderers?: Renderers; modelFilter?: (slot: Slot, models: Model[]) => Model[]; clock?: () => number | Date;
}

export interface DayStorage { list(): Promise<Day[]> | Day[]; save(d: { name: string; slots: Slot[] }): Promise<Day> | Day; remove(id: string): Promise<void> | void }

export type InvalidReason = 'min-gap' | 'max-slots' | 'min-slots' | 'duplicate-time' | 'locked';
export interface Issue { id?: string; day?: Weekday; code: InvalidReason | 'unknown-model' | 'time-format' | 'missing-ref'; message: string }
export interface ClockOpts { utcOffsetMinutes?: number; timeZone?: string }
export interface ActiveInfo { slot: Slot; index: number; start: number; end: number; elapsed: number; remaining: number }
export interface WeekActiveInfo extends ActiveInfo { day: Weekday; dayOffset: number }

export interface ChangeDetail { value: Value; resolved: Slot[] | ResolvedWeek; previous: Value; id?: string; day?: Weekday; detached?: boolean;
  source: 'drag'|'keyboard'|'model'|'values'|'label'|'time'|'add'|'remove'|'preset'|'day'|'copy'|'randomize'|'api' }
export interface DayRhythmEventMap {
  input: CustomEvent<ChangeDetail>; change: CustomEvent<ChangeDetail>;
  dayview: CustomEvent<{ day: Weekday; previous: Weekday }>;
  dayselect: CustomEvent<{ kind: 'preset' | 'day'; id: string; slots: Slot[]; day?: Weekday }>;
  daysave: CustomEvent<{ name: string; slots: Slot[]; waitUntil(p: Promise<unknown>): void }>;
  daydelete: CustomEvent<{ day: Day; waitUntil(p: Promise<unknown>): void }>;
  slotopen: CustomEvent<{ id: string }>; slotclose: CustomEvent<{ id: string }>;
  slotinvalid: CustomEvent<{ reason: InvalidReason; id?: string; limit?: number }>;
  error: CustomEvent<{ source: 'preset' | 'storage' | 'load' | 'config' | 'render'; error: unknown }>;
  ready: CustomEvent<{}>;
}

export class DayRhythmElement extends HTMLElement {
  static version: string; static define(tag?: string): void;
  value: Value; config: Config; models: Model[]; presets: Preset[]; days: Day[]; storage: Config['storage'];
  renderers: Renderers; messages: Record<string, string>; classes: Config['classes']; modelFilter: Config['modelFilter']; clock: Config['clock'];
  readonly now: number; readonly nowDay: Weekday; readonly resolvedOrientation: 'horizontal' | 'vertical';
  readonly editing: string | null; readonly weekMode: boolean;
  addSlot(partial?: Partial<Slot>, opts?: { day?: Weekday; edit?: boolean }): Slot | null;
  removeSlot(id: string): boolean; updateSlot(id: string, patch: Partial<Slot>): Slot | null; moveSlot(id: string, time: string): boolean;
  setValue(v: Value): void; setDay(slots: Slot[]): void;
  getValue(opts?: { compact?: boolean; resolve?: boolean }): Value; getDay(day?: Weekday): Slot[]; getWeek(opts?: { resolve?: boolean }): WeekValue | ResolvedWeek | null;
  getSlot(id: string): Slot | null; activeSlot(at?: string | number | Date | { day: Weekday; time: string | number }): Slot | null;
  selectDay(d: Weekday): void; prevDay(): void; nextDay(): void;
  copyDay(from: Weekday, to: Weekday[] | 'weekdays' | 'weekend' | 'all', opts?: { newIds?: boolean }): boolean;
  assignDay(day: Weekday, slotsOrRef: Slot[] | DayRef): boolean;
  openEditor(id: string): void; closeEditor(): void; focusSlot(id: string): void;
  syncClock(t: string | Date | number | { day: Weekday; time: string }): void;
  validate(): Issue[]; randomize(filter?: (m: Model, s: Slot) => boolean): void;
  configure(partial: Config): void; reloadConfig(): void; exportConfig(opts?: { includeValue?: boolean }): Config;
  addEventListener<K extends keyof DayRhythmEventMap>(t: K, l: (e: DayRhythmEventMap[K]) => void, o?: boolean | AddEventListenerOptions): void;
}
declare global { interface HTMLElementTagNameMap { 'day-rhythm': DayRhythmElement } }
```

## Appendix B - one JSON config, all keys with defaults

```json
{
  "$schema": "https://unpkg.com/dayrhythm/schema/config.schema.json",
  "value": [ { "time": "07:00", "model": "on" }, { "time": "22:00", "model": "off" } ],
  "name": "",
  "models": [ { "id": "on", "label": "On", "preview": "#f5c542" }, { "id": "off", "label": "Off", "off": true } ],
  "presets": [], "days": [],
  "load": null, "storage": null,
  "minGap": 30, "snap": 5, "minSlots": 1, "maxSlots": null,
  "origin": "first", "seamDrag": true, "orientation": "auto", "breakpoint": 640,
  "add": true, "remove": true, "rename": true, "timeEdit": true,
  "showPresets": true, "showDays": true, "spectrum": true, "nowLine": true,
  "clockOffset": 0, "timezone": null, "timeFormat": "24h",
  "editor": "auto", "randomize": false, "readonly": false, "disabled": false, "labelMax": 40,
  "week": "auto", "day": null, "firstDay": "auto", "weekPreview": true, "weekCopy": true, "linkDays": false,
  "theme": "organic", "colorScheme": "auto", "locale": null,
  "messages": {}, "classes": {}, "render": "shadow", "inheritStyles": false, "styles": null,
  "credits": true
}
```
