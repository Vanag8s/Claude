/* "Harbor calls you" demo + "Build your Harbor from your website" */
(() => {
  const $ = s => document.querySelector(s);
  const post = async (url, body) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let j = {}; try { j = await r.json(); } catch {}
    return { ok: r.ok, status: r.status, ...j };
  };
  const busy = (btn, on) => { btn.disabled = on; btn.classList.toggle('is-loading', on); };

  /* ---------- Call me ---------- */
  const cf = $('#callMe');
  cf?.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#callMsg'), btn = cf.querySelector('button[type=submit]');
    const phone = $('#callPhone').value.trim();
    msg.className = 'callme__msg';
    if (phone.replace(/\D/g, '').length < 8) { msg.textContent = 'Please enter your mobile number.'; msg.classList.add('bad'); $('#callPhone').focus(); return; }
    if (!$('#callConsent').checked) { msg.textContent = 'Please tick the box so we may call you.'; msg.classList.add('bad'); return; }
    busy(btn, true);
    try {
      const r = await post('/api/demo-call', { phone, consent: true, website: cf.website.value, voice: window.harborVoices?.gender || 'female' });
      if (r.ok) {
        msg.textContent = '📞 Calling you now… pick up and pretend you\'re a customer. Try interrupting it!';
        msg.classList.add('ok'); window.hTrack?.('demo_call_placed');
      } else {
        msg.textContent = r.status === 404 ? "The phone demo isn't switched on yet. Try the chat demo above!" : (r.error || 'Something went wrong. Try again.');
        msg.classList.add('bad');
      }
    } catch { msg.textContent = 'Network error. Try again.'; msg.classList.add('bad'); }
    busy(btn, false);
  });

  /* ---------- Build your Harbor ---------- */
  const bf = $('#buildForm');
  const el = (tag, text, cls) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
  let profile = null;
  bf?.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#buildMsg'), btn = bf.querySelector('button[type=submit]'), url = $('#buildUrl').value.trim();
    msg.className = 'build__msg';
    if (!/\w+\.\w{2,}/.test(url)) { msg.textContent = 'Enter your website, e.g. yourbusiness.com'; msg.classList.add('bad'); return; }
    busy(btn, true);
    const steps = ['Reading your website…', 'Learning your services and prices…', 'Writing your phone script…'];
    let i = 0; msg.textContent = steps[0];
    const tick = setInterval(() => { i = Math.min(i + 1, steps.length - 1); msg.textContent = steps[i]; }, 2200);
    try {
      const r = await post('/api/onboard', { url });
      if (!r.ok) throw new Error(r.status === 404 ? "This feature switches on once the site is deployed. Book a free audit and we'll build it for you!" : (r.error || 'Something went wrong.'));
      profile = r.profile; render(profile);
      msg.textContent = ''; window.hTrack?.('build_done', { trade: profile.trade });
    } catch (err) { msg.textContent = err.message; msg.classList.add('bad'); }
    clearInterval(tick); busy(btn, false);
  });

  function render(p) {
    $('#pCompany').textContent = p.company || 'Your business';
    $('#pTrade').textContent = p.trade || '';
    $('#pGreeting').textContent = p.greeting || '';
    const sv = $('#pServices'); sv.replaceChildren();
    (p.services || []).forEach(s => { const li = el('li', s.name); li.append(el('b', s.price)); sv.append(li); });
    if (!sv.children.length) sv.append(el('li', 'No prices on your site yet: you tell us, Harbor quotes them.'));
    $('#pHours').textContent = p.hours ? '🕑 ' + p.hours : '🕑 Hours: not on your site';
    $('#pArea').textContent = (p.service_area || []).length ? '📍 ' + p.service_area.join(', ') : '📍 Service area: not on your site';
    const fq = $('#pFaq'); fq.replaceChildren(); (p.faq || []).slice(0, 3).forEach(f => fq.append(el('li', f.q)));
    const ms = $('#pMissing'); ms.replaceChildren(); (p.missing || []).slice(0, 5).forEach(m => ms.append(el('li', m)));
    $('#pMissingCard').hidden = !ms.children.length;
    $('#buildOut').hidden = false;
    $('#buildOut').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const company = document.getElementById('company'); if (company && !company.value) company.value = p.company || '';
  }

  $('#pHear')?.addEventListener('click', () => {
    if (!('speechSynthesis' in window) || !profile) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(profile.greeting);
    const v = speechSynthesis.getVoices().filter(x => x.lang.startsWith('en')).find(x => /natural|neural|samantha|google us|aria|jenny/i.test(x.name));
    if (v) u.voice = v; u.rate = 1.05; speechSynthesis.speak(u);
  });
  $('#pChat')?.addEventListener('click', () => { if (profile) { window.harborBot?.useProfile(profile); window.hTrack?.('build_chat_open'); } });
})();
