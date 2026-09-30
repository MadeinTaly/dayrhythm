import { pack, range } from './_util.js';

const pos = (position, tilt) => ({ defaults: { position, tilt }, summary: '{position}% · {tilt}°' });

export default pack({
  id: 'blinds', title: ['Blinds and shutters', 'Tapparelle e tende'], description: 'Open, close and tilt shutters through the week.',
  config: { week: 'top' },
  models: [
    ['open', '🪟', '#ffd166', ['Open', 'Aperta'], pos(100, 0)],
    ['half', '◑', '#f4a261', ['Half', 'Metà'], pos(50, 0)],
    ['closed', '🌑', '#3d5a80', ['Closed', 'Chiusa'], pos(0, 0)],
    ['tilt', '📐', { field: 'position', min: 0, max: 100, from: '#3d5a80', to: '#ffd166' }, ['Tilt', 'Inclinata'], {
      defaults: { position: 100, tilt: 45 }, summary: '{position} · {tilt}',
      fields: [range('position', ['Position', 'Posizione'], 0, 100, 5, '%', 100), range('tilt', ['Tilt', 'Inclinazione'], 0, 90, 5, '°', 45)],
    }],
    ['sun-shade', '🕶️', '#e9c46a', ['Sun shade', 'Ombreggiante'], pos(60, 20)],
  ],
  presets: [
    ['summer-heat', ['Summer heat', 'Caldo estivo'], [['07:00', 'open'], ['11:00', 'sun-shade'], ['18:30', 'half'], ['22:30', 'closed']]],
    ['winter', ['Winter', 'Inverno'], [['08:00', 'open'], ['17:00', 'closed']]],
    ['vacation', ['Vacation', 'Vacanza'], [['00:00', 'closed']]],
  ],
  weekly: { all: 'summer-heat' },
});
