import lightScenes from './light-scenes.js';
import aquariumReef from './aquarium-reef.js';
import screenFilter from './screen-filter.js';
import thermostat from './thermostat.js';
import irrigation from './irrigation.js';
import blinds from './blinds.js';
import poolPump from './pool-pump.js';
import evCharging from './ev-charging.js';
import growLight from './grow-light.js';
import officeHours from './office-hours.js';
import waterHeater from './water-heater.js';
import ventilation from './ventilation.js';
import petFeeder from './pet-feeder.js';
import presenceSimulation from './presence-simulation.js';
import gardenLighting from './garden-lighting.js';
import sleepWake from './sleep-wake.js';
import { icons } from '../icons/index.js';

const list = [lightScenes, aquariumReef, screenFilter, thermostat, irrigation, blinds, poolPump, evCharging, growLight, officeHours, waterHeater, ventilation, petFeeder, presenceSimulation, gardenLighting, sleepWake];

/** id -> pack (plain config objects). */
export const packs = Object.fromEntries(list.map((p) => [p.id, p]));
export default packs;

// Opt-in line icons: model id -> icon name, with per-pack overrides where one id means different things.
const BY_MODEL = {
  sunrise: 'sunrise', dawn: 'sunrise', 'sunrise-ramp': 'sunrise', 'wake-ramp': 'sunrise', day: 'sun', midday: 'sun', afternoon: 'sun', awake: 'sun', morning: 'cloud-sun',
  sunset: 'sunset', dusk: 'sunset', evening: 'sunset', night: 'moon-star', moon: 'moon-star', 'wind-down': 'moon-star', storm: 'cloud-lightning', off: 'power', none: 'power', custom: 'sliders-horizontal',
  living: 'sofa', bedroom: 'bed', dark: 'lightbulb-off', random: 'dices', water: 'droplets', feed: 'paw-print', sleep: 'moon', eco: 'leaf', comfort: 'sofa', away: 'luggage', boost: 'flame',
  'solar-only': 'sun', cheap: 'coins', fast: 'zap', pause: 'pause', seedling: 'sprout', vegetative: 'leaf', flowering: 'flower', path: 'lamp-floor', party: 'party-popper', security: 'shield-check',
};
const BY_PACK = {
  'light-scenes': { evening: 'lamp-desk', moonlight: 'sparkles' },
  'screen-filter': { soft: 'sun-dim', deep: 'moon-star', cinema: 'clapperboard' },
  blinds: { open: 'panel-top-open', half: 'panel-top-close', closed: 'blinds', tilt: 'blinds', 'sun-shade': 'glasses' },
  'office-hours': { open: 'store', closed: 'lock', lunch: 'utensils', focus: 'headphones', 'on-call': 'phone-call' },
  thermostat: { manual: 'thermometer' },
  'water-heater': { comfort: 'shower-head', 'anti-legionella': 'virus' },
  ventilation: { low: 'fan', normal: 'wind', boost: 'tornado', 'night-cool': 'snowflake' },
  'pool-pump': { low: 'moon', normal: 'waves', boost: 'chevrons-up' },
};

/** JSON copy of a pack whose model icons are inline SVG line icons (see `dayrhythm/icons`) instead of emoji. */
export function withLineIcons(pack, opts) {
  const copy = JSON.parse(JSON.stringify(pack));
  for (const m of copy.models || []) {
    const name = BY_PACK[copy.id]?.[m.id] ?? BY_MODEL[m.id];
    // { names: true }: the icon name, for pages that registered the icon set (keeps the JSON short)
    if (name && icons[name]) m.icon = opts && opts.names ? name : icons[name];
  }
  return copy;
}
