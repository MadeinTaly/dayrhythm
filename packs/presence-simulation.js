import { pack } from './_util.js';

const rooms = { key: 'rooms', type: 'select', label: ['Rooms', 'Stanze'], default: 'all', options: [
  { value: 'all', label: ['All rooms', 'Tutte le stanze'] }, { value: 'living', label: ['Living room only', 'Solo soggiorno'] }, { value: 'upstairs', label: ['Upstairs', 'Piano di sopra'] }] };

export default pack({
  id: 'presence-simulation', title: ['Presence simulation', 'Simulazione di presenza'], description: 'Make an empty home look lived in while away.',
  models: [
    ['dark', '🌑', null, ['Dark', 'Buio'], { off: true }],
    ['living', '🛋️', '#f4d35e', ['Living room', 'Soggiorno'], { defaults: { rooms: 'living' }, summary: '{rooms}' }],
    ['bedroom', '🛏️', '#e9c46a', ['Bedroom', 'Camera'], { defaults: { rooms: 'upstairs' }, summary: '{rooms}' }],
    ['random', '🎲', '#c77dff', ['Random', 'Casuale'], { defaults: { rooms: 'all' }, summary: '{rooms}', fields: [rooms] }],
  ],
  presets: [
    ['vacation', ['Vacation', 'Vacanza'], [['00:00', 'dark'], ['18:30', 'living'], ['22:30', 'bedroom'], ['23:30', 'dark']]],
    ['short-trip', ['Short trip', 'Breve viaggio'], [['00:00', 'dark'], ['19:00', 'random', { rooms: 'all' }], ['23:00', 'dark']]],
  ],
  value: 'vacation',
});
