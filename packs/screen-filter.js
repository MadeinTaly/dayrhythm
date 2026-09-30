import { pack, range } from './_util.js';

const f = (red, bright, temp) => ({ defaults: { red, bright, temp }, summary: '{bright}% · {temp} K' });

export default pack({
  id: 'screen-filter', title: ['Screen filter', 'Filtro schermo'], description: 'Warm and dim a TV or monitor as the evening goes on.',
  models: [
    ['off', '⏻', null, ['Off', 'Spento'], { off: true }],
    ['soft', '🔆', '#e8d9b8', ['Soft', 'Morbido'], f(10, 85, 3600)],
    ['evening', '🌇', '#d9a86c', ['Evening', 'Sera'], f(20, 70, 2800)],
    ['cinema', '🎬', '#a9713f', ['Cinema', 'Cinema'], f(25, 55, 2200)],
    ['night', '🌙', '#7a4a2a', ['Night', 'Notte'], f(40, 35, 1600)],
    ['deep', '🌑', '#3d2417', ['Deep night', 'Notte fonda'], f(55, 15, 1200)],
    ['custom', '🎚️', { field: 'bright', min: 5, max: 100, from: '#1b1b1b', to: '#cdbfa8' }, ['Custom', 'Personalizzata'], {
      defaults: { red: 20, bright: 40, temp: 1100 }, summary: '{bright} · {temp}',
      fields: [range('red', ['Red tint', 'Tinta rossa'], 0, 100, 5, '%', 20, '#b57520'), range('bright', ['Brightness', 'Luminosità'], 5, 100, 5, '%', 40, '#328466'),
        { ...range('temp', ['Temperature', 'Temperatura'], 1000, 4000, 100, 'K', 1100), format: '{value} K' }],
    }],
  ],
  presets: [
    ['movie', ['Movie', 'Film'], [['00:00', 'off'], ['18:00', 'evening'], ['20:30', 'cinema'], ['23:00', 'night']]],
    ['early', ['Early', 'Presto'], [['07:00', 'off'], ['17:00', 'evening'], ['19:30', 'night']]],
    ['late', ['Late', 'Tardi'], [['09:00', 'off'], ['19:00', 'soft'], ['21:00', 'evening'], ['23:00', 'cinema'], ['01:00', 'deep']]],
  ],
  value: 'movie',
});
