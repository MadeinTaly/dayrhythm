import { pack, range } from './_util.js';

export default pack({
  id: 'irrigation', title: ['Garden watering', 'Irrigazione giardino'], description: 'Watering windows per weekday, with zone and flow.',
  config: { week: 'top', minGap: 15 },
  models: [
    ['off', '⏻', null, ['Off', 'Spento'], { off: true }],
    ['water', '💧', '#3aa6d8', ['Water', 'Irriga'], {
      defaults: { zone: 'all', flow: 100 }, summary: '{zone} · {flow}',
      fields: [
        { key: 'zone', type: 'select', label: ['Zone', 'Zona'], default: 'all', options: [
          { value: 'all', label: ['All zones', 'Tutte le zone'] }, { value: 'lawn', label: ['Lawn', 'Prato'] }, { value: 'beds', label: ['Flower beds', 'Aiuole'] }, { value: 'veg', label: ['Vegetable garden', 'Orto'] }] },
        range('flow', ['Flow', 'Portata'], 10, 100, 10, '%', 100),
      ],
    }],
  ],
  presets: [
    ['summer', ['Summer', 'Estate'], [['05:30', 'water'], ['06:15', 'off'], ['21:00', 'water'], ['21:45', 'off']]],
    ['spring-autumn', ['Spring/Autumn', 'Primavera/Autunno'], [['06:00', 'water', { zone: 'all', flow: 70 }], ['06:30', 'off']]],
  ],
  weekly: { mon: 'summer', wed: 'summer', fri: 'summer', sat: 'spring-autumn' },
});
