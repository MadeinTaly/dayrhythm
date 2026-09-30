import { pack, range } from './_util.js';

const fan = (s) => ({ defaults: { speed: s }, summary: '{speed}', fields: [range('speed', ['Fan speed', 'Velocità ventola'], 10, 100, 10, '%', s)] });

export default pack({
  id: 'ventilation', title: ['Ventilation', 'Ventilazione'], description: 'Fan or mechanical ventilation speeds through the day.',
  models: [
    ['off', '⏻', null, ['Off', 'Spenta'], { off: true }],
    ['low', '🍃', '#a8dadc', ['Low', 'Bassa'], fan(30)],
    ['normal', '🌬️', '#5fa8d3', ['Normal', 'Normale'], fan(60)],
    ['boost', '💨', '#1d6fa5', ['Boost', 'Boost'], fan(100)],
    ['night-cool', '❄️', '#4361ee', ['Night cooling', 'Raffrescamento notturno'], { defaults: { speed: 80 }, summary: '{speed}% night' }],
  ],
  presets: [
    ['bathroom', ['Bathroom', 'Bagno'], [['00:00', 'low'], ['06:30', 'boost'], ['07:30', 'low'], ['21:00', 'boost'], ['21:30', 'low']]],
    ['kitchen', ['Kitchen', 'Cucina'], [['00:00', 'off'], ['07:00', 'normal'], ['08:00', 'off'], ['12:00', 'boost'], ['13:00', 'off'], ['19:00', 'boost'], ['20:30', 'off']]],
    ['summer-night', ['Summer night', 'Notte d\'estate'], [['06:30', 'low'], ['21:30', 'night-cool']]],
  ],
  value: 'bathroom',
});
