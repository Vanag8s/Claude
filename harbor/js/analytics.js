/* Consent-gated analytics. Nothing non-essential loads until the visitor accepts.
   Set GA_ID to your Google Analytics 4 Measurement ID (G-XXXXXXX) before launch. */
(() => {
  const GA_ID = 'G-XXXXXXXXXX';
  const KEY = 'harbor_consent';
  const banner = document.getElementById('cookie');
  const queue = [];
  let loaded = false;

  const get = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const set = v => { try { localStorage.setItem(KEY, v); } catch {} };

  function load() {
    if (loaded || GA_ID.includes('XXXX')) { loaded = true; return; }
    loaded = true;
    const s = document.createElement('script');
    s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.append(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
    queue.splice(0).forEach(([n, p]) => gtag('event', n, p));
  }

  window.hTrack = (name, params = {}) => {
    if (get() !== 'accept') return;
    if (window.gtag) gtag('event', name, params); else queue.push([name, params]);
  };

  const choice = get();
  if (choice === 'accept') load();
  if (!choice) setTimeout(() => (banner.hidden = false), 2200);

  banner.addEventListener('click', e => {
    const b = e.target.closest('[data-consent]');
    if (!b) return;
    set(b.dataset.consent);
    banner.hidden = true;
    if (b.dataset.consent === 'accept') load();
  });
  document.getElementById('cookieSettings')?.addEventListener('click', () => (banner.hidden = false));
})();
