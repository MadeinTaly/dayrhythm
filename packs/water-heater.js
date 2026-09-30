import { pack } from './_util.js';

const tf = (d) => ({ key: 'temp', type: 'range', label: ['Water temperature', 'Temperatura acqua'], min: 30, max: 70, step: 1, unit: ' °C', default: d });

export default pack({
  id: 'water-heater', title: ['Water heater', 'Scaldabagno'], description: 'Boiler or domestic hot water modes and setpoints.',
  config: { week: 'top' },
  models: [
    ['off', '⏻', null, ['Off', 'Spento'], { off: true }],
    ['eco', '🌿', '#6d8fd6', ['Eco', 'Eco'], { defaults: { temp: 45 }, summary: '{temp}', fields: [tf(45)] }],
    ['comfort', '🚿', '#e59a4b', ['Comfort', 'Comfort'], { defaults: { temp: 55 }, summary: '{temp}', fields: [tf(55)] }],
    ['boost', '🔥', '#e5533b', ['Boost', 'Boost'], { defaults: { temp: 65 }, summary: '{temp}', fields: [tf(65)] }],
    ['anti-legionella', '🦠', '#8e2b6b', ['Anti-legionella', 'Anti-legionella'], { defaults: { temp: 70 }, summary: '{temp} °C' }],
  ],
  presets: [
    ['night-tariff', ['Night tariff', 'Tariffa notturna'], [['06:00', 'eco'], ['17:30', 'comfort'], ['23:00', 'boost']]],
    ['solar-surplus', ['Solar surplus', 'Surplus solare'], [['00:00', 'off'], ['11:00', 'boost'], ['16:00', 'eco'], ['22:00', 'off']]],
  ],
  weekly: { all: 'night-tariff' },
});
