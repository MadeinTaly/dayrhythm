import { pack, range } from './_util.js';

const lamp = (white, blue, power) => ({ defaults: { white, blue, power }, summary: 'W {white}% · B {blue}% · {power}%' });

export default pack({
  id: 'aquarium-reef', title: ['Reef aquarium lamp', 'Lampada acquario marino'], description: 'Photoperiod of a reef tank light with white and blue channels.',
  models: [
    ['dawn', '🌅', '#f0a36b', ['Dawn', 'Alba'], lamp(0, 25, 20)],
    ['morning', '🌤️', '#8ecae6', ['Morning', 'Mattina'], lamp(35, 60, 55)],
    ['midday', '☀️', '#4cc9f0', ['Midday', 'Mezzogiorno'], lamp(70, 80, 85)],
    ['afternoon', '🌞', '#5aa9e6', ['Afternoon', 'Pomeriggio'], lamp(45, 70, 65)],
    ['dusk', '🌆', '#9d6bd6', ['Dusk', 'Tramonto'], lamp(0, 30, 25)],
    ['moon', '🌙', '#1d3a8a', ['Moon', 'Luna'], lamp(0, 5, 5)],
    ['off', '⏻', null, ['Off', 'Spento'], { off: true }],
    ['storm', '⛈️', '#5d6d7e', ['Storm', 'Temporale'], lamp(10, 40, 35)],
    ['custom', '🎛️', { field: 'power', min: 0, max: 100, from: '#0b1e3a', to: '#8fd3ff' }, ['Custom', 'Personalizzata'], {
      defaults: { white: 40, blue: 60, power: 60 }, summary: 'W {white} · B {blue} · {power}',
      fields: [range('white', ['White', 'Bianco'], 0, 100, 5, '%', 40, '#789286'), range('blue', ['Blue', 'Blu'], 0, 100, 5, '%', 60, '#2a6fdb'), range('power', ['Power', 'Potenza'], 0, 100, 5, '%', 60, '#328466')],
    }],
  ],
  presets: [
    ['reef', ['Reef', 'Barriera'], [['00:00', 'moon'], ['08:00', 'dawn'], ['09:00', 'morning'], ['11:30', 'midday'], ['16:00', 'afternoon'], ['19:00', 'dusk'], ['20:00', 'moon']]],
    ['fowlr', ['FOWLR', 'FOWLR'], [['00:00', 'off'], ['09:00', 'dawn'], ['10:00', 'morning'], ['13:00', 'afternoon'], ['18:00', 'dusk'], ['19:00', 'moon'], ['22:00', 'off']]],
    ['planted', ['Planted', 'Piantumato'], [['00:00', 'off'], ['08:00', 'morning'], ['11:00', 'midday'], ['15:00', 'afternoon'], ['18:00', 'dusk'], ['19:00', 'off']]],
    ['acclimation', ['Acclimation', 'Acclimatamento'], [['00:00', 'off'], ['10:00', 'dawn'], ['11:00', 'morning'], ['15:00', 'dusk'], ['16:00', 'off']]],
  ],
  value: 'reef',
});
