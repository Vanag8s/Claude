/* Harbor's voice in the browser: choose a woman's or a man's voice, hear a sample,
   and have replies read aloud. Picks the most natural voice the device offers
   (Edge's "Natural" voices and Safari/Chrome premium voices sound best). */
(() => {
  if (!('speechSynthesis' in window)) { window.harborVoices = null; return; }
  const FEMALE = /(female|woman|samantha|victoria|karen|moira|tessa|serena|fiona|allison|ava|susan|zira|aria|jenny|michelle|emma|sonia|libby|natasha|clara|salli|joanna|kendra|kimberly|ivy|ona|agne|ingrid|amelie|anna|helena|elena|sara|paulina|monica|luciana|joana|zuzana|alice|nora|ellen|kate|catherine|hazel|heera|neerja|google us english$)/i;
  const MALE = /(\bmale\b|\bman\b|daniel|alex\b|fred|tom\b|oliver|aaron|arthur|david|mark|guy|ryan|christopher|eric|roger|steffan|thomas|william|matthew|justin|joey|brian|rishi|leonas|george|james|liam|jorge|diego|thomas|yuri|maged|rocko|reed|eddy|grandpa|ralph|google uk english male)/i;
  const QUALITY = /(natural|neural|online|premium|enhanced|siri|google)/i;
  const KEY = 'harbor_voice';
  let voices = [], listeners = [];
  const load = () => { voices = speechSynthesis.getVoices(); listeners.forEach(f => f()); };
  load(); speechSynthesis.addEventListener?.('voiceschanged', load);

  const genderOf = v => (MALE.test(v.name) && !/female/i.test(v.name) ? 'male' : FEMALE.test(v.name) ? 'female' : 'unknown');
  const langMatch = (v, lang) => v.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2));

  function best(gender, lang = 'en') {
    const pool = voices.filter(v => langMatch(v, lang));
    const scored = (pool.length ? pool : voices).map(v => ({
      v, s: (genderOf(v) === gender ? 10 : genderOf(v) === 'unknown' ? 2 : 0) + (QUALITY.test(v.name) ? 4 : 0) + (v.localService ? 0 : 1) + (/en-US/i.test(v.lang) ? 1 : 0),
    })).sort((a, b) => b.s - a.s);
    return scored[0]?.v || null;
  }

  let pref = { gender: 'female', uri: null, lang: 'en' };
  try { Object.assign(pref, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch {} };

  function current() {
    if (pref.uri) { const v = voices.find(x => x.voiceURI === pref.uri); if (v) return v; }
    return best(pref.gender, pref.lang);
  }

  function speak(text, { rate = 1.03, onend } = {}) {
    const clean = String(text).replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '').replace(/\$(\d+)–\$(\d+)/g, '$$$1 to $$$2');
    const u = new SpeechSynthesisUtterance(clean);
    const v = current(); if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = rate; u.pitch = pref.gender === 'male' ? 0.95 : 1.02;
    if (onend) u.onend = u.onerror = onend;
    speechSynthesis.speak(u);
    return u;
  }

  window.harborVoices = {
    get gender() { return pref.gender; },
    get voice() { return current(); },
    setGender(g) { pref.gender = g; pref.uri = null; save(); listeners.forEach(f => f()); },
    setVoice(uri) { pref.uri = uri; const v = voices.find(x => x.voiceURI === uri); if (v && genderOf(v) !== 'unknown') pref.gender = genderOf(v); save(); listeners.forEach(f => f()); },
    setLang(l) { pref.lang = l || 'en'; listeners.forEach(f => f()); },
    list(lang = pref.lang) { const l = voices.filter(v => langMatch(v, lang)); return (l.length ? l : voices).map(v => ({ uri: v.voiceURI, name: v.name, lang: v.lang, gender: genderOf(v), natural: QUALITY.test(v.name) })); },
    hasGender: g => voices.some(v => genderOf(v) === g),
    speak,
    sample(company = 'Harbor') {
      speechSynthesis.cancel();
      return speak(pref.gender === 'male'
        ? `Hi, thanks for calling ${company}. This is Harbor, the virtual assistant. How can I help you today?`
        : `Hi there, thanks for calling ${company}! This is Harbor, the virtual assistant. How can I help?`);
    },
    onChange(f) { listeners.push(f); },
  };

  /* Drop-in picker: <div data-voice-picker></div> */
  function mount(el) {
    el.classList.add('vpick');
    el.innerHTML = `
      <div class="vpick__seg" role="group" aria-label="Harbor's voice">
        <button type="button" data-g="female" aria-pressed="false">👩 Woman</button>
        <button type="button" data-g="male" aria-pressed="false">👨 Man</button>
      </div>
      <button type="button" class="vpick__hear" aria-label="Hear Harbor's voice">▶ Hear it</button>
      <label class="vpick__aloud"><input type="checkbox" data-aloud> Read replies aloud</label>
      <details class="vpick__more"><summary>More voices</summary><select aria-label="All voices on this device"></select><p class="vpick__note"></p></details>`;
    const sel = el.querySelector('select'), note = el.querySelector('.vpick__note');
    const render = () => {
      el.querySelectorAll('[data-g]').forEach(b => { const on = b.dataset.g === pref.gender; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
      const cur = current();
      sel.replaceChildren(...window.harborVoices.list().map(v => { const o = document.createElement('option'); o.value = v.uri; o.textContent = `${v.name}${v.natural ? ' ★' : ''} (${v.lang})`; if (cur && cur.voiceURI === v.uri) o.selected = true; return o; }));
      note.textContent = cur ? `Now using: ${cur.name}. ★ = most natural. Edge and Safari have the most lifelike voices.` : 'No voices found on this device.';
    };
    el.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => { window.harborVoices.setGender(b.dataset.g); window.harborVoices.sample(el.dataset.company || document.getElementById('testName')?.textContent || 'Harbor'); }));
    el.querySelector('.vpick__hear').addEventListener('click', () => window.harborVoices.sample(el.dataset.company || document.getElementById('testName')?.textContent || 'Harbor'));
    sel.addEventListener('change', () => { window.harborVoices.setVoice(sel.value); window.harborVoices.sample(); });
    const aloud = el.querySelector('[data-aloud]');
    aloud.addEventListener('change', () => { window.harborVoices.aloud = aloud.checked; if (!aloud.checked) speechSynthesis.cancel(); });
    window.harborVoices.onChange(render); render();
  }
  window.harborVoices.aloud = false;
  const init = () => document.querySelectorAll('[data-voice-picker]').forEach(mount);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
