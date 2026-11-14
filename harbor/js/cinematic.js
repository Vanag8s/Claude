/* Cinematic layer: parallax, cursor light, scroll story, waveform player. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  if (!reduce) document.documentElement.classList.add('js-motion');

  /* ---------- Parallax ---------- */
  const layers = [...document.querySelectorAll('[data-parallax]')];
  if (!reduce && layers.length) {
    let ticking = false;
    const update = () => {
      const vh = innerHeight;
      layers.forEach(el => {
        const box = (el.closest('figure, section, .hero__photo') || el).getBoundingClientRect();
        if (box.bottom < -200 || box.top > vh + 200) return;
        const speed = +el.dataset.parallax;
        const offset = (box.top + box.height / 2 - vh / 2) * -speed;
        el.style.translate = `0 ${offset.toFixed(1)}px`;
      });
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', update); update();
  }

  /* ---------- Warm light that follows the cursor over the hero ---------- */
  const glow = document.getElementById('heroGlow'), hero = document.querySelector('.hero');
  if (glow && hero && fine && !reduce) {
    hero.addEventListener('mousemove', e => { const r = hero.getBoundingClientRect(); glow.style.left = `${e.clientX - r.left}px`; glow.style.top = `${e.clientY - r.top}px`; });
    hero.addEventListener('mouseleave', () => { glow.style.left = glow.style.top = '-999px'; });
  }

  /* ---------- Scroll story: the phone follows the steps ---------- */
  const steps = [...document.querySelectorAll('.story__step')];
  const screens = [...document.querySelectorAll('.scr')];
  const show = n => {
    steps.forEach(s => s.classList.toggle('is-active', +s.dataset.step === n));
    screens.forEach(s => s.classList.toggle('is-on', +s.dataset.scr === n));
  };
  if (steps.length) {
    const io = new IntersectionObserver(entries => {
      entries.filter(e => e.isIntersecting).forEach(e => show(+e.target.dataset.step));
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(s => io.observe(s));
    show(0);
  }

  /* ---------- Waveform player for the sample call ---------- */
  const audio = document.getElementById('callAudio'), canvas = document.getElementById('waveCanvas'), btn = document.getElementById('waveBtn'), time = document.getElementById('waveTime');
  if (audio && canvas && btn) {
    document.getElementById('wavePlayer')?.parentElement.classList.add('has-wave');
    const ctx = canvas.getContext('2d');
    let peaks = null, loadedSrc = '';
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const fallbackPeaks = n => Array.from({ length: n }, (_, i) => 0.25 + 0.6 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11)));

    function draw() {
      const dpr = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w) return;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const bars = Math.floor(w / 4), data = peaks ? resample(peaks, bars) : fallbackPeaks(bars);
      const progress = audio.duration ? audio.currentTime / audio.duration : 0;
      data.forEach((p, i) => {
        const bh = Math.max(3, p * (h - 6));
        ctx.fillStyle = i / bars < progress ? css('--coral') : 'rgba(22,50,74,.28)';
        ctx.fillRect(i * 4, (h - bh) / 2, 2.5, bh);
      });
    }
    const resample = (arr, n) => Array.from({ length: n }, (_, i) => arr[Math.floor(i * arr.length / n)]);

    async function loadPeaks() {
      if (loadedSrc === audio.src) return;
      loadedSrc = audio.src; peaks = null; draw();
      try {
        const buf = await (await fetch(audio.src)).arrayBuffer();
        const AC = window.AudioContext || window.webkitAudioContext;
        const decoded = await new AC().decodeAudioData(buf);
        const ch = decoded.getChannelData(0), n = 400, size = Math.floor(ch.length / n);
        const out = [];
        for (let i = 0; i < n; i++) { let m = 0; for (let j = i * size; j < (i + 1) * size; j += 16) m = Math.max(m, Math.abs(ch[j])); out.push(m); }
        const max = Math.max(...out) || 1; peaks = out.map(x => Math.pow(x / max, 0.8));
        time.textContent = fmt(decoded.duration);
      } catch { /* keep the stylized bars */ }
      draw();
    }

    btn.addEventListener('click', () => {
      if (audio.paused) { document.querySelectorAll('audio').forEach(a => a !== audio && a.pause()); audio.play().catch(() => {}); } else audio.pause();
    });
    canvas.addEventListener('click', e => {
      if (!audio.duration) { audio.play().catch(() => {}); return; }
      const r = canvas.getBoundingClientRect(); audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; draw();
    });
    audio.addEventListener('play', () => { btn.textContent = '❚❚'; btn.setAttribute('aria-label', 'Pause the sample call'); loop(); });
    audio.addEventListener('pause', () => { btn.textContent = '▶'; btn.setAttribute('aria-label', 'Play the sample call'); });
    audio.addEventListener('ended', () => { btn.textContent = '▶'; draw(); });
    audio.addEventListener('timeupdate', () => { if (audio.duration) time.textContent = fmt(audio.duration - audio.currentTime); });
    new MutationObserver(() => loadPeaks()).observe(audio, { attributes: true, attributeFilter: ['src'] });
    const loop = () => { draw(); if (!audio.paused) requestAnimationFrame(loop); };
    addEventListener('resize', draw);
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { loadPeaks(); o.disconnect(); } }).observe(canvas);
    draw();
  }

  /* ---------- Marquee drifts faster while you scroll ---------- */
  const track = document.querySelector('.marquee__track');
  if (track && !reduce) {
    let last = scrollY, boost = 0;
    addEventListener('scroll', () => { boost = Math.min(4, Math.abs(scrollY - last) / 20); last = scrollY; }, { passive: true });
    const tick = () => { boost *= 0.92; track.style.animationDuration = `${40 / (1 + boost)}s`; requestAnimationFrame(tick); };
    tick();
  }
})();

/* ---------- Premium layer: tabs, product tour, particles ---------- */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Accessible tabs (click, arrow keys, Home/End)
  function tabs(list, onChange) {
    if (!list) return null;
    const btns = [...list.querySelectorAll('[role=tab]')];
    const select = (btn, focus) => {
      btns.forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(b.getAttribute('aria-controls'));
        if (panel) { panel.hidden = !on; panel.classList.toggle('is-on', on); }
      });
      if (focus) btn.focus();
      onChange?.(btn);
    };
    btns.forEach((b, i) => {
      b.addEventListener('click', () => select(b));
      b.addEventListener('keydown', e => {
        const k = e.key, n = btns.length;
        const j = k === 'ArrowRight' || k === 'ArrowDown' ? (i + 1) % n : k === 'ArrowLeft' || k === 'ArrowUp' ? (i - 1 + n) % n : k === 'Home' ? 0 : k === 'End' ? n - 1 : -1;
        if (j >= 0) { e.preventDefault(); select(btns[j], true); }
      });
    });
    return { btns, select };
  }

  tabs(document.querySelector('.ind__tabs'), b => window.hTrack?.('industry_tab', { id: b.id.replace('ind-tab-', '') }));

  // Product tour: advances by itself until the visitor takes over
  const tour = document.querySelector('.tour');
  const TITLES = { 'tour-tab-teach': 'Setup · Northside Realty', 'tour-tab-answer': 'Live call · Northside Realty', 'tour-tab-sell': 'Live call · Core Fitness (Sales mode)', 'tour-tab-report': 'After the call' };
  const t = tabs(document.querySelector('.tour__tabs'), b => { const el = document.getElementById('tourTitle'); if (el) el.textContent = TITLES[b.id] || ''; });
  if (tour && t && !reduce) {
    let auto = true, visible = false, timer;
    const stop = () => { auto = false; tour.classList.add('is-paused'); clearInterval(timer); };
    t.btns.forEach(b => { b.addEventListener('pointerdown', stop); b.addEventListener('keydown', stop); });
    tour.querySelector('.tour__screen')?.addEventListener('pointerenter', stop);
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting; clearInterval(timer);
      if (visible && auto) timer = setInterval(() => { const i = t.btns.findIndex(b => b.classList.contains('is-on')); t.select(t.btns[(i + 1) % t.btns.length]); }, 7000);
    }, { threshold: 0.4 }).observe(tour);
  } else if (tour) tour.classList.add('is-paused');

  // Hero particles: slow drifting motes, paused when off-screen
  const cv = document.getElementById('particles');
  if (cv && !reduce) {
    const ctx = cv.getContext('2d'); let w, h, dpr, on = true;
    const N = innerWidth < 760 ? 26 : 56;
    const pts = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8, vx: (Math.random() - 0.5) * 0.00012, vy: -0.00006 - Math.random() * 0.00014, a: 0.15 + Math.random() * 0.5, sand: Math.random() < 0.4, ph: Math.random() * 6.28 }));
    const size = () => { dpr = Math.min(devicePixelRatio || 1, 1.5); w = cv.width = cv.offsetWidth * dpr; h = cv.height = cv.offsetHeight * dpr; };
    size(); addEventListener('resize', size);
    new IntersectionObserver(([e]) => (on = e.isIntersecting)).observe(cv);
    let last = performance.now();
    const draw = now => {
      requestAnimationFrame(draw);
      if (!on || document.hidden) { last = now; return; }
      const dt = Math.min(now - last, 50); last = now;
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.ph += dt * 0.001;
        if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        if (p.x < -0.02) p.x = 1.02; if (p.x > 1.02) p.x = -0.02;
        const tw = 0.6 + 0.4 * Math.sin(p.ph);
        ctx.beginPath(); ctx.arc(p.x * w, p.y * h, p.r * dpr, 0, 6.283);
        ctx.fillStyle = p.sand ? `rgba(216,198,165,${p.a * tw})` : `rgba(160,185,212,${p.a * tw})`;
        ctx.fill();
      }
    };
    requestAnimationFrame(draw);
  }
})();
