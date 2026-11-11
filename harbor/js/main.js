(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  $('#yr').textContent = new Date().getFullYear();

  /* ---------- Split headings into words for cinematic reveal ---------- */
  $$('.split').forEach(el => {
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(part); return; }
            const w = document.createElement('span'); w.className = 'w';
            const i = document.createElement('span'); i.textContent = part;
            w.append(i); frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
    $$('.w > span', el).forEach((s, i) => (s.style.transitionDelay = `${i * 55}ms`));
  });

  /* ---------- Scroll reveal ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      if (e.target.matches('.stat')) countUp($('b', e.target));
      io.unobserve(e.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal, .split').forEach((el, i) => {
    if (el.classList.contains('reveal') && !el.style.transitionDelay) {
      const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
      el.style.transitionDelay = `${Math.min(sibs.indexOf(el), 6) * 90}ms`;
    }
    io.observe(el);
  });
  // Hero is visible immediately (after curtain)
  setTimeout(() => $$('.hero .reveal, .hero .split').forEach(el => el.classList.add('is-in')), reduce ? 0 : 1100);

  function countUp(el) {
    const end = +el.dataset.count, pre = el.dataset.prefix ? el.dataset.prefix.replace('&lt;', '<') : '', suf = el.dataset.suffix || '';
    if (reduce) { el.textContent = pre + end + suf; return; }
    const t0 = performance.now(), dur = 1600;
    const tick = t => {
      const p = Math.min((t - t0) / dur, 1), v = Math.round(end * (1 - Math.pow(1 - p, 4)));
      el.textContent = pre + v + suf;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Nav ---------- */
  const nav = $('#nav'), sticky = $('.stickycta');
  const onScroll = () => {
    nav.classList.toggle('is-scrolled', scrollY > 30);
    const book = ($('#join') || $('#book')).getBoundingClientRect();
    sticky.classList.toggle('is-on', scrollY > innerHeight * 0.8 && book.top > innerHeight);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const toggle = $('.nav__toggle'), menu = $('#mobileMenu');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', open); menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  });
  $$('a', menu).forEach(a => a.addEventListener('click', () => toggle.click()));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) toggle.click(); });

  /* ---------- Hero call simulation ---------- */
  const script = [
    ['ai', "Hi, thanks for calling Bright Smile Dental, this is Harbor, the virtual assistant. How can I help?"],
    ['cx', "Hi, I chipped a tooth at dinner and it really hurts."],
    ['ai', "Oh no, I'm sorry, that sounds painful. Let's get you seen quickly. Is it bleeding, or just sore?"],
    ['cx', "Just sore, but it's sharp."],
    ['ai', "Okay. Our first emergency slot is tomorrow at 9:30. Would that work?"],
    ['cx', "Yes please."],
    ['ai', "You're booked. I'll text you the details. Warm salt water can help tonight. Take care!"]
  ];
  const log = $('#callLog'), booked = $('#callBooked');
  let loopTimer;
  const playCall = () => {
    log.innerHTML = ''; booked.hidden = true;
    let i = 0;
    const next = () => {
      if (i < script.length) {
        const [who, text] = script[i++];
        const li = document.createElement('li'); li.className = who; li.textContent = text;
        log.append(li);
        loopTimer = setTimeout(next, reduce ? 0 : 1500 + text.length * 14);
      } else {
        booked.hidden = false;
        loopTimer = setTimeout(playCall, 7000);
      }
    };
    next();
  };
  if (reduce) { script.forEach(([w, t]) => { const li = document.createElement('li'); li.className = w; li.textContent = t; log.append(li); }); booked.hidden = false; }
  else setTimeout(playCall, 1800);

  /* ---------- Magnetic buttons + tilt cards + spotlight ---------- */
  if (fine && !reduce) {
    $$('.magnetic').forEach(b => {
      b.addEventListener('mousemove', e => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px,${(e.clientY - r.top - r.height / 2) * 0.28}px)`;
      });
      b.addEventListener('mouseleave', () => (b.style.transform = ''));
    });
    $$('.tilt').forEach(c => {
      c.addEventListener('mousemove', e => {
        const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.style.setProperty('--mx', x * 100 + '%'); c.style.setProperty('--my', y * 100 + '%');
        c.style.transform = `perspective(800px) rotateX(${(0.5 - y) * 8}deg) rotateY(${(x - 0.5) * 8}deg)`;
      });
      c.addEventListener('mouseleave', () => (c.style.transform = ''));
    });
  }

  /* ---------- ROI calculator ---------- */
  const fmt = n => '$' + Math.round(n).toLocaleString('en-US');
  const ids = ['calls', 'missed', 'ticket', 'close'];
  const roi = () => {
    const v = Object.fromEntries(ids.map(id => [id, +$('#' + id).value]));
    ids.forEach(id => {
      const el = $('#' + id);
      el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');
    });
    $('#callsOut').textContent = v.calls;
    $('#missedOut').textContent = v.missed + '%';
    $('#ticketOut').textContent = fmt(v.ticket);
    $('#closeOut').textContent = v.close + '%';
    const lostMonthly = v.calls * 4.33 * (v.missed / 100) * (v.close / 100) * v.ticket;
    const recovered = lostMonthly * 0.5;
    $('#lost').textContent = fmt(lostMonthly);
    $('#recovered').textContent = fmt(recovered);
    $('#multiple').textContent = (recovered / 349).toFixed(1) + '×';
  };
  ids.forEach(id => $('#' + id).addEventListener('input', roi)); roi();
  let roiTracked = false;
  $('#roiForm').addEventListener('input', () => { if (!roiTracked) { roiTracked = true; window.hTrack?.('roi_used'); } });
  $('#roiForm').addEventListener('submit', e => e.preventDefault());

  /* ---------- Pricing toggle ---------- */
  $$('.toggle button').forEach(b => b.addEventListener('click', () => {
    $$('.toggle button').forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b); });
    const k = b.dataset.billing === 'annual' ? 'a' : 'm';
    $$('.plan__price b').forEach(p => (p.textContent = '$' + (+p.dataset[k]).toLocaleString('en-US')));
  }));
  $$('[data-plan]').forEach(a => a.addEventListener('click', () => { $('#planField').value = a.dataset.plan; const sel = $('#planSelect'); if (sel) sel.value = a.dataset.plan; }));

  /* ---------- Lead form: validation + submit ---------- */
  const form = $('#leadForm');
  const msgs = {
    name: 'Please enter your name.', company: 'Please enter your business name.',
    email: 'Please enter a valid email address.', phone: 'Please enter a valid phone number.', trade: 'Please choose your trade.'
  };
  const check = el => {
    const ok = el.checkValidity();
    el.classList.toggle('invalid', !ok);
    el.setAttribute('aria-invalid', !ok);
    const err = el.parentElement.querySelector('.err');
    if (err) err.textContent = ok ? '' : msgs[el.name] || 'Please check this field.';
    return ok;
  };
  $$('input:not([type=checkbox]):not([name=website]), select', form).forEach(el => {
    el.addEventListener('blur', () => check(el));
    el.addEventListener('input', () => el.classList.contains('invalid') && check(el));
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fields = $$('input:not([type=checkbox]):not([type=hidden]):not([name=website]), select', form);
    let ok = fields.map(check).every(Boolean);
    const cb = $('#consentBox');
    $('#consentErr').textContent = cb.checked ? '' : 'Please accept so we can contact you.';
    ok = ok && cb.checked;
    if (!ok) { form.querySelector('.invalid, #consentBox:not(:checked)')?.focus(); return; }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Sending…';
    const data = Object.fromEntries(new FormData(form));
    try {
      const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
    } catch (err) {
      // Static hosting fallback: keep the lead locally so nothing is lost during testing
      try { const q = JSON.parse(localStorage.getItem('harbor_leads') || '[]'); q.push({ ...data, at: Date.now() }); localStorage.setItem('harbor_leads', JSON.stringify(q)); } catch {}
    }
    window.hTrack?.('generate_lead', { trade: data.trade, plan: data.plan || 'none' });
    $('#formDone').hidden = false;
    $('#formDone').setAttribute('tabindex', '-1'); $('#formDone').focus();
  });

  /* ---------- CTA tracking ---------- */
  $$('[data-track]').forEach(el => el.addEventListener('click', () => window.hTrack?.('cta_click', { id: el.dataset.track })));
})();
