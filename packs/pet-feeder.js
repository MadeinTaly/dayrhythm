import { pack, range } from './_util.js';

export default pack({
  id: 'pet-feeder', title: ['Pet feeder', 'Distributore crocchette'], description: 'Feeding times with portion and food type.',
  config: { minGap: 15 },
  models: [
    ['none', '⏻', null, ['None', 'Niente'], { off: true }],
    ['feed', '🦴', '#e9a23b', ['Feed', 'Pasto'], {
      defaults: { portion: 40, type: 'dry' }, summary: '{portion} · {type}',
      fields: [range('portion', ['Portion', 'Porzione'], 5, 200, 5, ' g', 40),
        { key: 'type', type: 'select', label: ['Food', 'Cibo'], default: 'dry', options: [
          { value: 'dry', label: ['Dry', 'Secco'] }, { value: 'wet', label: ['Wet', 'Umido'] }, { value: 'treat', label: ['Treat', 'Snack'] }] }],
    }],
  ],
  presets: [
    ['twice-daily', ['Twice daily', 'Due volte al giorno'], [['07:30', 'feed'], ['07:45', 'none'], ['18:30', 'feed'], ['18:45', 'none']]],
    ['three-meals', ['Three meals', 'Tre pasti'], [['07:30', 'feed', { portion: 30, type: 'dry' }], ['07:45', 'none'], ['13:00', 'feed', { portion: 20, type: 'wet' }], ['13:15', 'none'], ['19:00', 'feed', { portion: 30, type: 'dry' }], ['19:15', 'none']]],
  ],
  value: 'twice-daily',
});
