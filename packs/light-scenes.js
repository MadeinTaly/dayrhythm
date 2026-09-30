import { pack, range } from './_util.js';

const sc = (b, k) => ({ defaults: { brightness: b, kelvin: k }, summary: '{brightness}% · {kelvin} K' });

export default pack({
  id: 'light-scenes', title: ['Light scenes', 'Scene di luce'], description: 'Smart lamp or mood lighting through the day.',
  models: [
    ['sunrise', '🌅', '#f4a261', ['Sunrise', 'Alba'], sc(40, 2400)],
    ['day', '☀️', '#ffd166', ['Day', 'Giorno'], sc(100, 5000)],
    ['sunset', '🌇', '#e76f51', ['Sunset', 'Tramonto'], sc(60, 2500)],
    ['evening', '🛋️', '#e9a23b', ['Evening', 'Sera'], sc(45, 2700)],
    ['night', '🌙', '#3d5a80', ['Night', 'Notte'], sc(15, 2200)],
    ['moonlight', '✨', '#98c1d9', ['Moonlight', 'Chiaro di luna'], sc(5, 4000)],
    ['off', '⏻', null, ['Off', 'Spento'], { off: true }],
    ['custom', '🎛️', { field: 'brightness', min: 0, max: 100, from: '#1b1b1b', to: '#ffe9b0' }, ['Custom', 'Personalizzata'], {
      defaults: { brightness: 70, kelvin: 3500 }, summary: '{brightness} · {kelvin}',
      fields: [range('brightness', ['Brightness', 'Luminosità'], 0, 100, 5, '%', 70, '#b57520'),
        { ...range('kelvin', ['Colour temperature', 'Temperatura colore'], 2000, 6500, 100, 'K', 3500), format: '{value} K' }],
    }],
  ],
  presets: [
    ['standard', ['Standard', 'Standard'], [['06:30', 'sunrise'], ['08:00', 'day'], ['18:30', 'sunset'], ['20:00', 'evening'], ['22:30', 'night']]],
    ['early-bird', ['Early bird', 'Mattiniero'], [['05:30', 'sunrise'], ['07:00', 'day'], ['17:30', 'sunset'], ['19:00', 'evening'], ['21:00', 'night']]],
    ['night-owl', ['Night owl', 'Nottambulo'], [['01:30', 'night'], ['08:30', 'sunrise'], ['10:00', 'day'], ['20:00', 'sunset'], ['22:00', 'evening']]],
  ],
  value: 'standard',
});
