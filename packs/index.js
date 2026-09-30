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

const list = [lightScenes, aquariumReef, screenFilter, thermostat, irrigation, blinds, poolPump, evCharging, growLight, officeHours, waterHeater, ventilation, petFeeder, presenceSimulation, gardenLighting, sleepWake];

/** id -> pack (plain config objects). */
export const packs = Object.fromEntries(list.map((p) => [p.id, p]));
export default packs;
