import { pack } from './_util.js';

const note = { key: 'note', type: 'text', label: ['Note', 'Nota'], default: '' };
const cap = (d) => ({ key: 'capacity', type: 'number', label: ['Capacity', 'Capienza'], min: 0, max: 500, step: 1, default: d });

export default pack({
  id: 'office-hours', title: ['Opening hours', 'Orari di apertura'], description: 'Opening hours and presence for a team or a shop.',
  config: { week: 'top' },
  models: [
    ['open', '🟢', '#2a9d8f', ['Open', 'Aperto'], { defaults: { capacity: 20, note: '' }, summary: '{capacity}', fields: [cap(20), note] }],
    ['lunch', '🍽️', '#e9c46a', ['Lunch', 'Pausa pranzo'], {}],
    ['focus', '🎧', '#457b9d', ['Focus time', 'Tempo di concentrazione'], { defaults: { note: '' }, fields: [note] }],
    ['closed', '🔒', '#6c757d', ['Closed', 'Chiuso'], {}],
    ['on-call', '📞', '#e76f51', ['On call', 'Reperibile'], { defaults: { note: '' }, fields: [note] }],
  ],
  presets: [
    ['standard', ['Standard', 'Standard'], [['00:00', 'closed'], ['08:30', 'open'], ['12:30', 'lunch'], ['13:30', 'open'], ['17:30', 'closed']]],
    ['summer', ['Summer', 'Estate'], [['00:00', 'closed'], ['08:00', 'open'], ['13:00', 'closed']]],
    ['retail', ['Retail', 'Negozio'], [['00:00', 'closed'], ['09:00', 'open'], ['13:00', 'lunch'], ['15:30', 'open'], ['20:00', 'closed']]],
  ],
  weekly: { weekdays: 'standard', sat: 'summer' },
});
