import { pack, range } from './_util.js';

const br = (b) => ({ defaults: { brightness: b }, summary: '{brightness}', fields: [range('brightness', ['Brightness', 'Luminosità'], 10, 100, 10, '%', b)] });

export default pack({
  id: 'garden-lighting', title: ['Garden lighting', 'Luci da giardino'], description: 'Outdoor path, party and security lights.',
  models: [
    ['off', '⏻', null, ['Off', 'Spente'], { off: true }],
    ['path', '🔦', '#a7c957', ['Path', 'Vialetto'], br(50)],
    ['party', '🎉', '#c77dff', ['Party', 'Festa'], br(90)],
    ['security', '🛡️', '#e63946', ['Security', 'Sicurezza'], br(100)],
  ],
  presets: [
    ['dusk-to-dawn', ['Dusk to dawn', 'Dal tramonto all\'alba'], [['06:00', 'off'], ['19:00', 'path'], ['23:30', 'security']]],
    ['party-evening', ['Party evening', 'Serata in festa'], [['06:00', 'off'], ['19:00', 'party'], ['01:00', 'path'], ['02:00', 'off']]],
  ],
  value: 'dusk-to-dawn',
});
