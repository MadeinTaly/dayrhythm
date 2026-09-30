import { pack, range } from './_util.js';

const sp = (speed) => ({ defaults: { speed }, summary: '{speed}%' });

export default pack({
  id: 'pool-pump', title: ['Pool filtration', 'Filtrazione piscina'], description: 'Filter pump run times and speeds.',
  models: [
    ['off', '⏻', null, ['Off', 'Spenta'], { off: true }],
    ['low', '💤', '#8ecae6', ['Low', 'Bassa'], sp(35)],
    ['normal', '🌊', '#4cc9f0', ['Normal', 'Normale'], { defaults: { speed: 70 }, summary: '{speed}', fields: [range('speed', ['Speed', 'Velocità'], 40, 100, 5, '%', 70)] }],
    ['boost', '🚀', '#0077b6', ['Boost', 'Boost'], sp(100)],
  ],
  presets: [
    ['summer', ['Summer', 'Estate'], [['06:00', 'normal'], ['10:00', 'boost'], ['12:00', 'normal'], ['18:00', 'low'], ['21:00', 'off']]],
    ['winter', ['Winter', 'Inverno'], [['10:00', 'low'], ['14:00', 'off']]],
    ['solar-hours', ['Solar hours', 'Ore solari'], [['09:30', 'normal', { speed: 80 }], ['16:30', 'off']]],
  ],
  value: 'summer',
});
