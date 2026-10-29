# Examples

Compact, adapted from `packs/*.json` (emoji replaced by icon names; check names against the catalog before use). All three validate with `scripts/validate.mjs`. The full irrigation weekly config is in `example-irrigation.json`.

## 1. Heating, weekly setpoints (thermostat)

Fixed scenes with a temperature each, plus a manual slider. Preview colours run cold blue to hot red.

```json
{
  "week": "top", "theme": "neutral",
  "value": { "week": {
    "mon": [{ "time": "06:30", "model": "comfort" }, { "time": "08:30", "model": "eco" }, { "time": "17:30", "model": "comfort" }, { "time": "22:30", "model": "eco" }],
    "tue": [{ "time": "06:30", "model": "comfort" }, { "time": "08:30", "model": "eco" }, { "time": "17:30", "model": "comfort" }, { "time": "22:30", "model": "eco" }],
    "wed": [{ "time": "06:30", "model": "comfort" }, { "time": "08:30", "model": "eco" }, { "time": "17:30", "model": "comfort" }, { "time": "22:30", "model": "eco" }],
    "thu": [{ "time": "06:30", "model": "comfort" }, { "time": "08:30", "model": "eco" }, { "time": "17:30", "model": "comfort" }, { "time": "22:30", "model": "eco" }],
    "fri": [{ "time": "06:30", "model": "comfort" }, { "time": "08:30", "model": "eco" }, { "time": "17:30", "model": "comfort" }, { "time": "22:30", "model": "eco" }],
    "sat": [{ "time": "08:00", "model": "comfort" }, { "time": "23:00", "model": "eco" }],
    "sun": [{ "time": "08:00", "model": "comfort" }, { "time": "23:00", "model": "eco" }] } },
  "models": [
    { "id": "away", "label": "Away", "icon": "luggage", "preview": "#8aa1b1", "defaults": { "temp": 15 }, "summary": "{temp} °C" },
    { "id": "eco", "label": "Eco", "icon": "leaf", "preview": "#6d8fd6", "defaults": { "temp": 17 }, "summary": "{temp} °C" },
    { "id": "comfort", "label": "Comfort", "icon": "sofa", "preview": "#e59a4b", "defaults": { "temp": 21 }, "summary": "{temp} °C" },
    { "id": "boost", "label": "Boost", "icon": "flame", "preview": "#e5533b", "defaults": { "temp": 24 }, "summary": "{temp} °C" },
    { "id": "manual", "label": "Manual", "icon": "thermometer",
      "previewScale": { "field": "temp", "min": 5, "max": 30, "from": "#6d8fd6", "to": "#e5533b" },
      "defaults": { "temp": 20 }, "summary": "{temp}",
      "fields": [{ "key": "temp", "type": "range", "label": "Setpoint", "min": 5, "max": 30, "step": 0.5, "unit": " °C", "default": 20 }] }
  ],
  "presets": [
    { "id": "office", "label": "Office", "slots": [{ "time": "06:30", "model": "comfort" }, { "time": "08:30", "model": "eco" }, { "time": "17:30", "model": "comfort" }, { "time": "22:30", "model": "eco" }] },
    { "id": "home", "label": "Home all day", "slots": [{ "time": "06:30", "model": "comfort" }, { "time": "22:30", "model": "eco" }] },
    { "id": "holiday", "label": "Holiday", "slots": [{ "time": "00:00", "model": "away" }] }
  ]
}
```
Pattern: fixed models (defaults only) for common states + one `previewScale` manual model; weekdays identical, weekend different.

## 2. Evening screen filter, daily (screen-filter)

Daily array, three sliders in one editable model, scene models as fixed presets of those sliders.

```json
{
  "theme": "midnight", "minGap": 15,
  "value": [{ "time": "07:00", "model": "off" }, { "time": "19:00", "model": "evening" }, { "time": "22:00", "model": "night" }],
  "models": [
    { "id": "off", "label": "Off", "icon": "power", "off": true },
    { "id": "evening", "label": "Evening", "icon": "sunset", "preview": "#d9a86c", "defaults": { "red": 20, "bright": 70, "temp": 2800 }, "summary": "{bright}% · {temp} K" },
    { "id": "night", "label": "Night", "icon": "moon", "preview": "#7a4a2a", "defaults": { "red": 40, "bright": 35, "temp": 1600 }, "summary": "{bright}% · {temp} K" },
    { "id": "custom", "label": "Custom", "icon": "sliders-horizontal",
      "previewScale": { "field": "bright", "min": 5, "max": 100, "from": "#1b1b1b", "to": "#cdbfa8" },
      "defaults": { "red": 20, "bright": 40, "temp": 1100 }, "summary": "{bright} · {temp}",
      "fields": [
        { "key": "red", "type": "range", "label": "Red tint", "min": 0, "max": 100, "step": 5, "unit": "%", "default": 20, "accent": "#b57520" },
        { "key": "bright", "type": "range", "label": "Brightness", "min": 5, "max": 100, "step": 5, "unit": "%", "default": 40, "accent": "#328466" },
        { "key": "temp", "type": "range", "label": "Temperature", "min": 1000, "max": 4000, "step": 100, "unit": "K", "default": 1100, "format": "{value} K" } ] }
  ],
  "presets": [
    { "id": "movie", "label": "Movie", "slots": [{ "time": "07:00", "model": "off" }, { "time": "20:00", "model": "evening" }, { "time": "23:00", "model": "night" }] },
    { "id": "late", "label": "Late", "slots": [{ "time": "08:00", "model": "off" }, { "time": "21:30", "model": "night" }] }
  ]
}
```
Pattern: warm browns for evening/night previews; `format` for a unit that reads better as "2800 K".

## 3. Opening hours, weekly with text and number fields (office-hours)

Weekly, domain without devices: models are states, fields hold capacity and a note, Italian labels.

```json
{
  "week": "top", "locale": "it", "theme": "console", "minGap": 30, "snap": 15,
  "value": { "week": {
    "mon": [{ "time": "09:00", "model": "open" }, { "time": "13:00", "model": "lunch" }, { "time": "14:00", "model": "open" }, { "time": "18:00", "model": "closed" }],
    "tue": [{ "time": "09:00", "model": "open" }, { "time": "13:00", "model": "lunch" }, { "time": "14:00", "model": "open" }, { "time": "18:00", "model": "closed" }],
    "wed": [{ "time": "09:00", "model": "open" }, { "time": "13:00", "model": "lunch" }, { "time": "14:00", "model": "open" }, { "time": "18:00", "model": "closed" }],
    "thu": [{ "time": "09:00", "model": "open" }, { "time": "13:00", "model": "lunch" }, { "time": "14:00", "model": "open" }, { "time": "18:00", "model": "closed" }],
    "fri": [{ "time": "09:00", "model": "open" }, { "time": "13:00", "model": "lunch" }, { "time": "14:00", "model": "open" }, { "time": "17:00", "model": "closed" }],
    "sat": [{ "time": "00:00", "model": "closed" }],
    "sun": [] } },
  "models": [
    { "id": "open", "label": "Aperto", "icon": "door-open", "preview": "#2a9d8f", "defaults": { "capacity": 20, "note": "" }, "summary": "{capacity}",
      "fields": [
        { "key": "capacity", "type": "number", "label": "Capienza", "min": 0, "max": 500, "step": 1, "default": 20 },
        { "key": "note", "type": "text", "label": "Nota", "default": "" } ] },
    { "id": "lunch", "label": "Pausa pranzo", "icon": "utensils", "preview": "#e9c46a" },
    { "id": "closed", "label": "Chiuso", "icon": "lock", "preview": "#6c757d" }
  ],
  "presets": [
    { "id": "standard", "label": "Standard", "slots": [{ "time": "09:00", "model": "open" }, { "time": "13:00", "model": "lunch" }, { "time": "14:00", "model": "open" }, { "time": "18:00", "model": "closed" }] },
    { "id": "estate", "label": "Estate", "slots": [{ "time": "08:00", "model": "open" }, { "time": "14:00", "model": "closed" }] }
  ]
}
```
Pattern: plain models (no defaults) for pure states; `closed` Saturday via a single `00:00` slot, empty Sunday carries it on.
