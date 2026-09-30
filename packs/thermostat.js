import { pack } from './_util.js';

const t = (temp) => ({ defaults: { temp }, summary: '{temp} °C' });

export default pack({
  id: 'thermostat', title: ['Heating schedule', 'Programma riscaldamento'], description: 'Weekly heating or cooling setpoints.',
  config: { week: 'top' },
  models: [
    ['away', '🧳', '#8aa1b1', ['Away', 'Assente'], t(15)],
    ['eco', '🌿', '#6d8fd6', ['Eco', 'Eco'], t(17)],
    ['comfort', '🛋️', '#e59a4b', ['Comfort', 'Comfort'], t(21)],
    ['boost', '🔥', '#e5533b', ['Boost', 'Boost'], t(24)],
    ['manual', '🌡️', { field: 'temp', min: 5, max: 30, from: '#6d8fd6', to: '#e5533b' }, ['Manual', 'Manuale'], {
      defaults: { temp: 20 }, summary: '{temp}',
      fields: [{ key: 'temp', type: 'range', label: ['Setpoint', 'Temperatura'], min: 5, max: 30, step: 0.5, unit: ' °C', default: 20 }],
    }],
  ],
  presets: [
    ['office', ['Office', 'Ufficio'], [['06:30', 'comfort'], ['08:30', 'eco'], ['17:30', 'comfort'], ['22:30', 'eco']]],
    ['home', ['Home all day', 'A casa tutto il giorno'], [['06:30', 'comfort'], ['22:30', 'eco']]],
    ['holiday', ['Holiday', 'Vacanza'], [['00:00', 'away']]],
  ],
  weekly: { weekdays: 'office', weekend: 'home' },
});
