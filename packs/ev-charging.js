import { pack, range } from './_util.js';

const cur = (c) => range('current', ['Current', 'Corrente'], 6, 32, 1, ' A', c);
const lim = (l) => range('limit', ['Charge limit', 'Limite di carica'], 50, 100, 5, '% SoC', l);

export default pack({
  id: 'ev-charging', title: ['EV charging', 'Ricarica auto elettrica'], description: 'Charge by tariff window, solar surplus or manual limits.',
  config: { week: 'top' },
  models: [
    ['off', '⏻', null, ['Off', 'Spenta'], { off: true }],
    ['solar-only', '☀️', '#f4d35e', ['Solar only', 'Solo solare'], { defaults: { limit: 90 }, summary: '{limit}', fields: [lim(90)] }],
    ['cheap', '💡', '#83c5be', ['Cheap tariff', 'Tariffa bassa'], { defaults: { current: 16, limit: 80 }, summary: '{current} · {limit}', fields: [cur(16), lim(80)] }],
    ['fast', '⚡', '#e63946', ['Fast', 'Veloce'], { defaults: { current: 32, limit: 100 }, summary: '{current} · {limit}', fields: [cur(32), lim(100)] }],
    ['pause', '⏸️', '#adb5bd', ['Pause', 'Pausa'], { defaults: {}, summary: '' }],
  ],
  presets: [
    ['two-rate-night', ['Two-rate night', 'Bioraria notturna'], [['07:00', 'pause'], ['23:00', 'cheap']]],
    ['three-rate', ['Three-rate F1/F2/F3', 'Trioraria F1/F2/F3'], [['07:00', 'solar-only'], ['08:00', 'pause'], ['19:00', 'solar-only'], ['23:00', 'cheap']]],
    ['solar', ['Solar', 'Solare'], [['09:00', 'solar-only'], ['17:00', 'off']]],
  ],
  weekly: { weekdays: 'two-rate-night', weekend: 'solar' },
});
