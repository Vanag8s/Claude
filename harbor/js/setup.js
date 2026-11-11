/* Member setup: describe the business → Harbor builds its knowledge → test it → save. */
(() => {
  const $ = id => document.getElementById(id);
  const form = $('profileForm');
  const state = { id: null, key: null, history: [], brain: null, ctx: {}, dirty: false };

  /* ---------- Form <-> profile ---------- */
  const rowsEl = { offerings: $('offerings'), faq: $('faq') };
  function addRow(kind, v = {}) {
    const r = document.createElement('div');
    r.className = kind === 'faq' ? 'rowi rowi--faq' : 'rowi';
    const fields = kind === 'faq' ? [['q', 'Question'], ['a', 'Answer']] : [['name', 'Name'], ['price', 'Price'], ['details', 'Details (optional)']];
    fields.forEach(([k, ph]) => { const i = document.createElement('input'); i.dataset.k = k; i.placeholder = ph; i.value = v[k] || ''; i.setAttribute('aria-label', ph); r.append(i); });
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Remove'); x.onclick = () => { r.remove(); changed(); };
    r.append(x); rowsEl[kind].append(r);
  }
  document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => { addRow(b.dataset.add); changed(); }));

  function readProfile() {
    const f = new FormData(form), g = k => (f.get(k) || '').toString().trim();
    const rows = kind => [...rowsEl[kind].children].map(r => Object.fromEntries([...r.querySelectorAll('input')].map(i => [i.dataset.k, i.value.trim()])));
    return {
      company: g('company'), type: g('type'), mode: g('mode') || 'receptionist', language: g('language'), personality: g('personality'),
      hours: g('hours'), location: g('location'), contact: g('contact'),
      offerings: rows('offerings').filter(o => o.name), rules: g('rules'), faq: rows('faq').filter(x => x.q && x.a),
      about: g('about2') || ($('about').value.trim() && !g('company') ? $('about').value.trim() : ''),
      sales: { goal: g('sales.goal'), upsells: g('sales.upsells'), offers: g('sales.offers'), objections: g('sales.objections') },
      phone_number: g('phone_number'), owner_phone: g('owner_phone'), transfer_note: g('transfer_note'),
    };
  }
  function fillProfile(p) {
    const set = (k, v) => { const el = form.elements[k]; if (el) el.value = v || ''; };
    ['company', 'type', 'language', 'personality', 'hours', 'location', 'contact', 'rules', 'phone_number', 'owner_phone', 'transfer_note'].forEach(k => set(k, p[k]));
    set('about2', p.about);
    ['goal', 'upsells', 'offers', 'objections'].forEach(k => set('sales.' + k, p.sales?.[k]));
    form.querySelectorAll('input[name=mode]').forEach(r => (r.checked = r.value === (p.mode || 'receptionist')));
    rowsEl.offerings.replaceChildren(); (p.offerings || []).forEach(o => addRow('offerings', o)); if (!p.offerings?.length) addRow('offerings');
    rowsEl.faq.replaceChildren(); (p.faq || []).forEach(x => addRow('faq', x)); if (!p.faq?.length) addRow('faq');
    changed(true);
  }
  function changed(silent) {
    const p = readProfile();
    document.body.classList.toggle('is-sales', p.mode === 'sales');
    $('testName').textContent = p.company || 'Your business';
    $('testMode').textContent = p.mode;
    renderChips(p);
    if (!silent) { state.dirty = true; $('saveState').textContent = state.id ? 'Unsaved changes' : ''; }
  }
  form.addEventListener('input', () => changed());
  form.addEventListener('change', () => changed());

  /* ---------- Step 1: understand ---------- */
  async function post(url, body, headers = {}) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    let j = {}; try { j = await r.json(); } catch {}
    return { ok: r.ok, status: r.status, ...j };
  }
  $('understandBtn').addEventListener('click', async () => {
    const msg = $('understandMsg'), btn = $('understandBtn');
    const text = $('about').value.trim(), url = $('site').value.trim();
    msg.className = 'note';
    if (!text && !url) { msg.textContent = 'Write a few lines about your business first, or paste your website.'; msg.classList.add('bad'); return; }
    btn.disabled = true; btn.classList.add('is-loading'); msg.textContent = 'Harbor is reading and organizing everything…';
    try {
      const r = await post('/api/understand', { text, url });
      if (!r.ok) throw new Error(r.status === 404 || r.status >= 500 ? 'AI setup needs the live site (with an API key). For now, fill in step 2 by hand, or load the example.' : r.error);
      fillProfile(r.profile);
      msg.textContent = r.missing?.length ? `Done! Callers may also ask about: ${r.missing.slice(0, 4).join(', ')}.` : 'Done! Check step 2, then test it.';
      msg.classList.add('ok');
      if (!form.elements.about2.value && text) form.elements.about2.value = '';
    } catch (e) { msg.textContent = e.message; msg.classList.add('bad'); }
    btn.disabled = false; btn.classList.remove('is-loading');
  });
  $('exampleBtn').addEventListener('click', async () => {
    const p = await fetch('/config/example-waterpark.json').then(r => r.json());
    fillProfile(p);
    $('about').value = '';
    $('understandMsg').className = 'note ok';
    $('understandMsg').textContent = 'Loaded a made-up waterpark. Now test it on the right, or replace it with your real business.';
    resetTest();
  });

  // Dictation
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const d = $('dictateBtn'); d.hidden = false;
    const rec = new SR(); rec.continuous = true; rec.interimResults = false; rec.lang = navigator.language || 'en-US';
    let on = false;
    rec.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) $('about').value += (($('about').value && !/\s$/.test($('about').value)) ? ' ' : '') + e.results[i][0].transcript.trim() + '. '; };
    rec.onend = () => { if (on) try { rec.start(); } catch {} };
    d.addEventListener('click', () => { on = !on; d.classList.toggle('is-live', on); d.textContent = on ? '⏹ Stop' : '🎙 Dictate'; try { on ? rec.start() : rec.stop(); } catch {} });
  }

  /* ---------- Step 3: test chat ---------- */
  const log = $('testLog'), input = $('testInput');
  const scroll = () => (log.scrollTop = log.scrollHeight);
  const add = (text, who = 'ai', cls = '') => { const d = document.createElement('div'); d.className = `msg msg--${who} ${cls}`; d.textContent = text; log.append(d); scroll(); if (who === 'ai') voice.speak(text); return d; };
  const typing = () => { const d = document.createElement('div'); d.className = 'msg msg--ai typing'; d.innerHTML = '<i></i><i></i><i></i>'; log.append(d); scroll(); return d; };
  const LABEL = { book: '📅 Booking (test mode)', capture_sale: '💰 Sale captured (test mode)', take_message: '📝 Message for the team (test mode)', transfer_to_human: '📞 Would transfer to a person', end_call: '👋 Conversation ended' };
  function showActions(actions = []) {
    actions.forEach(a => {
      const d = document.createElement('div'); d.className = 'action' + (a.type === 'capture_sale' ? ' action--sale' : '');
      const b = document.createElement('b'); b.textContent = LABEL[a.type] || a.type; d.append(b);
      const details = Object.entries(a.details || {}).filter(([, v]) => v !== '' && v !== false).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join('\n');
      if (details) d.append(document.createTextNode(details));
      log.append(d); scroll();
    });
  }
  function resetTest() {
    log.innerHTML = ''; state.history = []; state.ctx = {};
    const p = readProfile();
    const g = `Hi, thanks for contacting ${p.company || 'us'}! This is Harbor, the virtual assistant. How can I help?`;
    add(g); state.history.push({ role: 'assistant', content: g });
  }
  $('testReset').addEventListener('click', resetTest);

  async function ask(q, via = 'text') {
    q = q.trim(); if (!q) return;
    add(q, 'me'); state.history.push({ role: 'user', content: q });
    const p = readProfile();
    const t = typing();
    let r = null;
    if (state.brain !== 'local') {
      try {
        const res = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: p, messages: state.history.slice(-24), via }) });
        if (res.ok) { r = await res.json(); setBrain('claude'); }
        else if (res.status === 404 || res.status >= 500) setBrain('local');
      } catch { setBrain('local'); }
    }
    if (!r) { await new Promise(x => setTimeout(x, 450)); r = window.harborKB.answer(p, q, state.ctx); r = { reply: r.text, actions: r.action ? [r.action] : [] }; }
    t.remove();
    add(r.reply); state.history.push({ role: 'assistant', content: r.reply });
    showActions(r.actions);
  }
  function setBrain(b) {
    state.brain = b;
    $('testBrain').textContent = b === 'claude' ? 'Claude AI' : 'offline test brain';
  }
  $('testForm').addEventListener('submit', e => { e.preventDefault(); const v = input.value; input.value = ''; ask(v); });

  function renderChips(p) {
    const qs = [p.hours ? 'When do you open?' : null,
      /park|pool|cinema|museum|zoo|club|gym/i.test(p.type + p.company) ? 'Can my 14-year-old come without a parent?' : 'Do you have availability tomorrow?',
      p.offerings?.length ? 'How much does it cost?' : null,
      p.mode === 'sales' ? "That's too expensive." : null,
      p.mode === 'sales' ? "OK, I'll take it." : 'Can I speak to a person?'].filter(Boolean);
    const ul = $('testChips'); ul.replaceChildren();
    qs.forEach(q => { const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = q; b.onclick = () => ask(q); li.append(b); ul.append(li); });
  }

  // Voice test: talk to it and interrupt it
  const voice = { on: false, speak: () => {} };
  const mic = $('testMic');
  if (SR && 'speechSynthesis' in window) {
    mic.hidden = false;
    const rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
    let speaking = '';
    const norm = t => t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    const echo = t => { if (!speaking) return false; const s = new Set(norm(speaking)), w = norm(t); return w.length && w.filter(x => s.has(x)).length / w.length > 0.6; };
    voice.speak = text => {
      if (!voice.on) return;
      const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, ''));
      const v = speechSynthesis.getVoices().filter(x => x.lang.startsWith('en')).find(x => /natural|neural|samantha|google us|aria|jenny|ava/i.test(x.name)); if (v) u.voice = v;
      u.rate = 1.05; speaking += ' ' + text; mic.classList.add('is-speaking');
      u.onend = () => { if (!speechSynthesis.speaking) { speaking = ''; mic.classList.remove('is-speaking'); } };
      speechSynthesis.speak(u);
    };
    rec.onresult = e => {
      const r = e.results[e.results.length - 1], t = r[0].transcript.trim();
      if (!t || echo(t)) return;
      if (speechSynthesis.speaking) { speechSynthesis.cancel(); speaking = ''; mic.classList.remove('is-speaking'); }
      input.value = t; if (r.isFinal) { input.value = ''; ask(t, 'voice'); }
    };
    rec.onend = () => { if (voice.on) setTimeout(() => { try { rec.start(); } catch {} }, 150); };
    mic.addEventListener('click', () => {
      voice.on = !voice.on; mic.setAttribute('aria-pressed', voice.on); mic.classList.toggle('is-live', voice.on);
      if (voice.on) { try { rec.start(); } catch {} } else { try { rec.abort(); } catch {} speechSynthesis.cancel(); }
    });
  }

  /* ---------- Step 4: save ---------- */
  $('saveBtn').addEventListener('click', async () => {
    const msg = $('saveMsg'), btn = $('saveBtn'); msg.className = 'note';
    const p = readProfile();
    if (!p.company) { msg.textContent = 'Add your business name first.'; msg.classList.add('bad'); form.elements.company.focus(); return; }
    btn.disabled = true;
    try {
      let r;
      if (state.id) r = await (await fetch('/api/business', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-admin-key': state.key }, body: JSON.stringify({ id: state.id, profile: p }) })).json().catch(() => ({}));
      else r = await post('/api/business', { profile: p });
      if (!r.id) throw new Error(r.error || 'Saving needs the live site. Your work is kept in this browser for now.');
      if (!state.id) {
        state.id = r.id; state.key = r.admin_key;
        try { localStorage.setItem('harbor_admin', JSON.stringify({ id: state.id, key: state.key })); } catch {}
        $('bizId').textContent = state.id; $('bizKey').textContent = state.key;
        $('editLink').href = `/setup.html?id=${encodeURIComponent(state.id)}`; $('keyBox').hidden = false;
      }
      state.dirty = false; $('saveState').textContent = 'Saved ✓';
      msg.textContent = p.phone_number ? `Saved! Calls to ${p.phone_number} will be answered as ${p.company}.` : 'Saved! Add your Harbor phone number above so calls reach this profile.';
      msg.classList.add('ok');
    } catch (e) { msg.textContent = e.message; msg.classList.add('bad'); }
    btn.disabled = false;
  });
  $('copyKey').addEventListener('click', () => navigator.clipboard?.writeText(state.key));

  // Keep a draft in this browser so nothing is lost
  setInterval(() => { try { localStorage.setItem('harbor_draft', JSON.stringify(readProfile())); } catch {} }, 4000);

  /* ---------- Start ---------- */
  (async () => {
    const id = new URL(location.href).searchParams.get('id');
    let saved = null; try { saved = JSON.parse(localStorage.getItem('harbor_admin') || 'null'); } catch {}
    if (id && saved?.id === id) {
      const r = await fetch(`/api/business?id=${encodeURIComponent(id)}`, { headers: { 'x-admin-key': saved.key } }).then(r => r.ok ? r.json() : null).catch(() => null);
      if (r?.profile) { state.id = id; state.key = saved.key; fillProfile(r.profile); $('saveState').textContent = 'Saved ✓'; resetTest(); return; }
    }
    let draft = null; try { draft = JSON.parse(localStorage.getItem('harbor_draft') || 'null'); } catch {}
    if (draft?.company) fillProfile(draft); else { addRow('offerings'); addRow('faq'); changed(true); }
    resetTest();
    $('testBrain').textContent = 'ready';
  })();
})();
