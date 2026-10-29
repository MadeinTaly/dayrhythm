# dayrhythm config cheatsheet

Full contract: `docs/API.md` in the package. JSON Schema: `schema/config.schema.json` (unknown top-level keys are rejected). Config is strict JSON.

## Top-level keys that matter for authoring

| Key | Type / values | Default | Notes |
|---|---|---|---|
| `value` | daily `Slot[]` or weekly `{ "week": {...} }` | 2 default slots | Initial schedule only |
| `models` | `Model[]` (min 1) | on/off | See below |
| `presets` | `{ id, label, icon?, group?, slots }[]` | `[]` | One preset = one day of slots |
| `days` | `{ id, name, slots }[]` | `[]` | Saved days; weekly entries may be `{ "ref": "<day id>" }` |
| `week` | `auto` `top` `bottom` `off` | `auto` | `top` for weekly; `auto` shows the bar iff `value` is weekly |
| `weekLayout` | `tabs` `rows` | `tabs` | `rows` = seven stacked 24 h rows |
| `minGap` | int minutes 1..720 | 5 | Minimum slot length |
| `snap` | 1,2,3,4,5,6,10,12,15,20,30,60 | 5 | Drag granularity, must divide 60 |
| `minSlots` / `maxSlots` | int / int or null | 1 daily, 0 weekly / null | Per day |
| `origin` | `first` `midnight` | `first` | Weekly forces `midnight` |
| `orientation` | `auto` `horizontal` `vertical` | `auto` | |
| `editor` | `auto` `quick` `full` | `auto` | `quick` closes the model grid on pick |
| `timeFormat` | `24h` `12h` | `24h` | Display only |
| `timezone` | IANA string | browser | e.g. `Europe/Rome` |
| `firstDay` | `auto` `mon`..`sun` | `auto` | Order of week tabs |
| `readonly` / `disabled` | bool | false | |
| `theme` | theme id string or theme object | `organic` | See themes.md |
| `colorScheme` | `auto` `light` `dark` | `auto` | |
| `locale` | `en` `it` (others via registration) | html lang, else `en` | |
| `messages` | flat or per-locale object | `{}` | See below |
| `name` | string | "" | Form field name |
| `showPresets` `spectrum` `nowLine` `add` `remove` `rename` `timeEdit` `randomize` | bool | true (randomize false) | Feature toggles |
| `credits` | `true` `false` `"minimal"` `"support"` | true | Leave alone |

Pack metadata `id`, `title`, `description` are accepted and ignored by the element. `$schema` is accepted.

## Slot

`{ "time": "HH:MM", "model": "<model id>", "label"?: "<=40 chars", "values"?: {...}, "id"?, "locked"? }`
- `time` zero-padded 24 h, minute resolution, unique within a day.
- Daily slot i is active from its time to the next slot's time; the last slot wraps past midnight to the first. One slot = the whole day.
- `values` overrides the model's `defaults` for that slot (keys = field keys).

## Daily vs weekly value

- Daily: `[ {slot}, {slot} ]`, sorted or not.
- Weekly: `{ "week": { "mon": [slots], "tue": [slots], ... "sun": [slots] } }`. Keys `mon tue wed thu fri sat sun`. Missing or `[]` = empty day: the previous day's last slot carries on all day. Sunday's last slot continues into Monday. Day gap rule is not cyclic per day.
- Day entry may be `{ "ref": "<saved day id>" }` (needs a matching entry in `days`).
- Presets stay single-day arrays in both modes.

## Model

`{ id (req), label, icon, preview, previewScale, off, defaults, fields, summary, group, hint, when, days, classes, meta }`
- `icon`: catalog name (`"droplets"`), inline `<svg ...>` string, URL string, `{ "src": "<url>" }` or an emoji/glyph. Prefer names.
- `preview`: CSS background; `{key}` interpolation allowed (`"hsl({hue} 70% 55%)"`). `previewScale`: `{ field, min, max, from, to }` interpolates two colours along a numeric field.
- `off: true`: striped "nothing happens" look.
- `defaults`: values given to a new slot. Fixed model = defaults only; editable = `fields` too.
- `summary`: `"{temp} °C"`; `{key}` takes a field's `unit`/`format` into account.
- `when: { from, to }`: offered only for slots starting in that window (may wrap midnight). `days: ["sat","sun"]`: weekly only.
- `group`: groups models in the picker. `hint`: help text.

## Field

`{ key (req), type (req), label, default, min, max, step, unit, format, options, accent }`
| type | Use | Needs |
|---|---|---|
| `range` | slider | min, max, step, default |
| `number` | numeric input | min, max, step, default |
| `select` | choice | `options: [{ value: string\|number, label }]`, default among them |
| `toggle` | boolean | default true/false |
| `color` | colour picker | default `#rrggbb` |
| `text` | free text | default `""` |
- `unit`: appended, include the leading space when you want one (`" °C"`, `" g"`, `"%"`).
- `format`: `"{value} K"` overrides unit formatting.
- `accent`: CSS colour for the slider.

## Locale and messages

Built-in UI languages: `en`, `it`. Model/field labels come from their own `label`, or from messages:
```json
"locale": "it",
"messages": { "it": { "model.water": "Irrigazione", "field.flow": "Portata", "opt.zone.all": "Tutte", "preset.estate": "Estate", "title": "Irrigazione" },
              "en": { "model.water": "Watering" } }
```
Keys: `model.<id>`, `field.<key>`, `opt.<fieldKey>.<value>`, `preset.<id>`, `title` (aria label), plus any UI key (`add`, `remove`, `nowLabel`, ...). Flat form `{ "add": "Add period" }` also works. Prefer plain `label`s for single-language configs; use messages when shipping en + it (as the packs do).

## Limits and gotchas

- Unknown top-level key = schema error. Put custom data in `models[].meta`.
- `snap` must divide 60; `minGap` should be a multiple of `snap`.
- Slot times unique per day; in daily mode the wrap gap (last -> first + 24 h) must also be >= `minGap`.
- `label` max 40 chars (`labelMax`).
- A model referenced by a slot but missing from `models` shows as "unknown model".
- No functions, comments or trailing commas in JSON.
