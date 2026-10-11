// Credits footer.
const REPO = 'https://github.com/MadeinTaly/dayrhythm';
const DONATE = 'https://gt.1471995.xyz';

export function creditsEl(el) {
  const mode = el.creditsMode;
  if (mode === 'off') return null;
  const c = el._mk('div', 'credits');
  const a = el._mk('a', 'credits-link', { text: el.t('credits'), attrs: { href: REPO, target: '_blank', rel: 'noopener' } });
  c.append(a);
  if (mode === 'support') c.append(el._mk('a', 'credits-donate', { text: el.t('donate'), attrs: { href: DONATE, target: '_blank', rel: 'noopener' } }));
  return c;
}
