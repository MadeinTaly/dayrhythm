import { pack, range } from './_util.js';

const sw = (v, b) => ({
  defaults: { volume: v, brightness: b }, summary: '{volume} · {brightness}',
  fields: [range('volume', ['Volume', 'Volume'], 0, 100, 5, '%', v), range('brightness', ['Brightness', 'Luminosità'], 0, 100, 5, '%', b)],
});

export default pack({
  id: 'sleep-wake', title: ['Sleep and wake', 'Sonno e sveglia'], description: 'Wind-down and wake-up ramps for light and sound.',
  config: { week: 'top' },
  models: [
    ['sleep', '😴', '#3d5a80', ['Sleep', 'Sonno'], sw(0, 0)],
    ['wind-down', '🌙', '#6d597a', ['Wind-down', 'Relax serale'], sw(20, 25)],
    ['wake-ramp', '🌅', '#f4a261', ['Wake ramp', 'Sveglia graduale'], sw(30, 60)],
    ['awake', '☀️', '#ffd166', ['Awake', 'Sveglio'], sw(50, 100)],
  ],
  presets: [
    ['school', ['School', 'Scuola'], [['06:30', 'wake-ramp'], ['07:00', 'awake'], ['20:30', 'wind-down'], ['21:30', 'sleep']]],
    ['weekend', ['Weekend', 'Fine settimana'], [['08:00', 'wake-ramp'], ['08:45', 'awake'], ['22:00', 'wind-down'], ['23:00', 'sleep']]],
  ],
  weekly: { weekdays: 'school', weekend: 'weekend' },
});
