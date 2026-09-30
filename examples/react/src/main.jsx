import { createRoot } from 'react-dom/client';
import { useMemo, useState } from 'react';
import { DayRhythm, useActiveSlot } from 'dayrhythm/react';
import thermostat from 'dayrhythm/packs/thermostat';

function App() {
  const cfg = useMemo(() => ({ ...thermostat, locale: 'en' }), []);
  const [value, setValue] = useState(thermostat.value);
  const [saved, setSaved] = useState(JSON.stringify(thermostat.value));
  const active = useActiveSlot(value);
  const dirty = JSON.stringify(value) !== saved;
  return (
    <main style={{ maxWidth: 820, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui' }}>
      <h1>dayrhythm + React</h1>
      <DayRhythm config={cfg} value={value} onChange={(next) => setValue(next)} fallback={<p>Loading...</p>} />
      <p>
        <button disabled={!dirty} onClick={() => setSaved(JSON.stringify(value))}>Save</button>{' '}
        Active now: {active ? `${active.model} (from ${active.time})` : 'none'}
      </p>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
