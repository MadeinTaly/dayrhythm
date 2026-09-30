import { pack, range } from './_util.js';

const gl = (intensity, ratio) => ({
  defaults: { intensity, ratio }, summary: '{intensity} · {ratio}',
  fields: [range('intensity', ['Intensity', 'Intensità'], 0, 100, 5, '%', intensity, '#328466'), range('ratio', ['Red share', 'Quota rosso'], 0, 100, 5, '% red', ratio, '#b5462f')],
});

export default pack({
  id: 'grow-light', title: ['Grow light', 'Luce di crescita'], description: 'Photoperiod for indoor plants with intensity and red/blue ratio.',
  models: [
    ['off', '⏻', null, ['Off', 'Spenta'], { off: true }],
    ['seedling', '🌱', '#95d5b2', ['Seedling', 'Germoglio'], gl(50, 40)],
    ['vegetative', '🌿', '#52b788', ['Vegetative', 'Vegetativa'], gl(75, 35)],
    ['flowering', '🌸', '#d66ba0', ['Flowering', 'Fioritura'], gl(100, 70)],
    ['sunrise-ramp', '🌅', '#f4a261', ['Sunrise ramp', 'Alba graduale'], { defaults: { intensity: 30, ratio: 50 }, summary: '{intensity}% ramp' }],
  ],
  presets: [
    ['18-6', ['18/6', '18/6'], [['00:00', 'off'], ['06:00', 'vegetative']]],
    ['12-12', ['12/12', '12/12'], [['06:00', 'flowering'], ['18:00', 'off']]],
    ['16-8', ['16/8', '16/8'], [['05:00', 'sunrise-ramp'], ['05:30', 'vegetative'], ['21:00', 'off']]],
  ],
  value: '18-6',
});
