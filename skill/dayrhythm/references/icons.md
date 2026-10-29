# Choosing icons

Models take `"icon": "<name>"`, a Lucide icon name from the catalog. The page registers the names with the icons bundle (`dist/dayrhythm-icons.min.js`, or `import { icons } from 'dayrhythm/icons'`). Fallbacks the validator also accepts: inline `<svg ...>`, a URL, `{ "src": url }`, an emoji (only when the user asks for emoji).

## Where the catalog is

Read the JSON file, do not guess names. Try in order:
1. `node_modules/dayrhythm/icons/catalog.json`
2. the dayrhythm repo: `icons/catalog.json`
3. CDN: `https://cdn.jsdelivr.net/npm/dayrhythm/icons/catalog.json` (WebFetch / curl, save locally if you want to pass it to `validate.mjs --catalog`)

Format: array of `{ "name": "sunrise", "category": "time-of-day", "keywords": ["dawn","morning"], "it": ["alba","mattina"], "aliases"?: ["..."] }`. `name` and every `aliases` entry are valid values for `icon`; use `name` in output.

## How to search

Do not read the whole file into the conversation if it is large. Search it:
```
node -e "const c=require('./node_modules/dayrhythm/icons/catalog.json');const q=process.argv.slice(1).map(s=>s.toLowerCase());for(const i of c){const h=[i.name,i.category,...(i.keywords||[]),...(i.it||[]),...(i.aliases||[])].join(' ').toLowerCase();if(q.some(w=>h.includes(w)))console.log(i.name,'|',i.category,'|',(i.keywords||[]).join(','))}" water drop pioggia
```
(or Grep the file for the keyword, with `-i`, in English and in Italian when the user writes Italian: the `it` array holds Italian synonyms). Run one search per model with 2-4 synonyms, pick the best match.

## Picking

- Match the MEANING of the model, not its label: "Away" -> a suitcase/door/plane, "Eco" -> leaf, "Boost" -> flame/zap, "Off" -> power, "Night" -> moon, "Day" -> sun, "Lunch" -> utensils, "Closed" -> lock, "Water" -> droplets.
- One icon per distinct meaning: no two models in the same config share an icon, and an icon is not reused for a different idea.
- Prefer simple, recognisable glyphs; at 22 px detailed icons blur.
- Stay in one visual family (all Lucide); never mix with emoji unless asked.
- If nothing fits, try the neighbouring category, then a more generic icon (`circle-dot`, `sliders-horizontal`); never invent a name. The validator rejects names that are not in the catalog.
- Presets may carry an `icon` too; same rules.

## Categories (typical; check the file for the exact list)

time-of-day (sunrise, sun, sunset, moon), weather (cloud, rain, snowflake, wind), climate and energy (thermometer, flame, fan, zap, battery, plug), home (house, door, window, bed, sofa, lamp), garden and nature (sprout, leaf, droplets, flower, tree), animals (paw-print, bone, fish, bird), food (utensils, coffee, cooking-pot), work and office (briefcase, headphones, phone, calendar), transport (car, plane, bike), media and devices (tv, monitor, music, volume), status and control (power, lock, play, pause, sliders-horizontal), health and routine (pill, heart, dumbbell, stethoscope).
