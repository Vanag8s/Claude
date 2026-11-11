/* Frostveil – cinematic scroll story, depth-of-field snow, layer stack, compare slider.
   Plain JS, no dependencies. */
(function () {
  'use strict';
  var F = window.Frost || {};
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a || 0, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (e0, e1, x) { var t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Visibility of a "a,b|c,d" range list at progress p */
  function rangeOpacity(spec, p, fade) {
    fade = fade || 0.022;
    return spec.split('|').reduce(function (best, r) {
      var ab = r.split(',').map(Number), a = ab[0], b = ab[1];
      var fin = a <= 0.001 ? 1 : smooth(a - fade, a + fade, p);
      var fout = b >= 0.999 ? 1 : 1 - smooth(b - fade, b + fade, p);
      return Math.max(best, fin * fout);
    }, 0);
  }

  /* ---------------- Depth-of-field snow ---------------- */
  function Snow(canvas) {
    var ctx = canvas.getContext('2d'), W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var flakes = [], sprites = [];
    // pre-render soft sprites: near flakes are big & blurry, far flakes are tiny & crisp
    for (var k = 0; k < 6; k++) {
      var s = document.createElement('canvas'), r = 6 + k * 7; s.width = s.height = r * 2;
      var g = s.getContext('2d'), grd = g.createRadialGradient(r, r, 0, r, r, r);
      var core = 0.55 - k * 0.07;
      grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(core, 'rgba(255,255,255,' + (0.9 - k * 0.1) + ')'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, r * 2, r * 2); sprites.push(s);
    }
    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round((W * H) / (W < 700 ? 5200 : 6500));
      flakes = [];
      for (var i = 0; i < n; i++) flakes.push(spawn(true));
    }
    function spawn(any) {
      var z = Math.pow(Math.random(), 2.2); // most flakes far away
      return { x: Math.random() * W, y: any ? Math.random() * H : -20, z: z, size: lerp(1.2, 26, z * z), speed: lerp(18, 120, z), drift: Math.random() * Math.PI * 2, a: lerp(0.35, 0.75, Math.random()) };
    }
    window.addEventListener('resize', resize); resize();
    this.amount = 1; this.wind = 0;
    var self = this;
    this.step = function (dt, t) {
      ctx.clearRect(0, 0, W, H);
      if (self.amount < 0.01) return;
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        f.y += f.speed * dt;
        f.x += (Math.sin(t * 0.6 + f.drift) * 12 + self.wind * 40) * dt * (0.4 + f.z);
        if (f.y > H + 30 || f.x < -40 || f.x > W + 40) { flakes[i] = spawn(false); flakes[i].x = Math.random() * W; continue; }
        var spr = sprites[Math.min(5, Math.floor(f.z * 6))];
        ctx.globalAlpha = f.a * self.amount * (f.z > 0.75 ? 0.55 : 1);
        ctx.drawImage(spr, f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
      }
      ctx.globalAlpha = 1;
    };
  }

  /* ---------------- Scroll story ---------------- */
  function initStory(root) {
    var stage = root.querySelector('.story__stage');
    var scenes = $$('[data-scene]', root).map(function (el) { return { el: el, spec: el.getAttribute('data-scene') }; });
    var inner = $$('[data-scene-inner]', root).map(function (el) { return { el: el, spec: el.getAttribute('data-scene-inner') }; });
    var chapters = $$('[data-chapter]', root).map(function (el) { return { el: el, from: +el.dataset.from || 0, to: +el.dataset.to || 1 }; });
    var dots = $$('[data-dot]', root);
    var float = root.querySelector('[data-float]');
    var frame = root.querySelector('[data-wipe-range]');
    var wipeR = frame ? frame.getAttribute('data-wipe-range').split(',').map(Number) : [0, 1];
    var hud = { temp: root.querySelector('[data-hud-temp]'), time: root.querySelector('[data-hud-time]'), glass: root.querySelector('[data-hud-glass]'), label: root.querySelector('[data-hud-label]') };
    var snowCanvas = root.querySelector('[data-snow]');
    var snow = snowCanvas && F.snow !== false && !REDUCED ? new Snow(snowCanvas) : null;

    // product pose keyframes: x/y in % of stage, scale, rotateX, rotateZ
    var KEYS = [
      { p: 0.00, x: 21, y: 3, s: 1.0, rx: 50, rz: -7 },
      { p: 0.13, x: 21, y: -2, s: 0.92, rx: 58, rz: -4 },
      { p: 0.30, x: 19, y: 4, s: 0.95, rx: 30, rz: 2 },
      { p: 0.40, x: 19, y: 2, s: 1.04, rx: 24, rz: 0 },
      { p: 0.50, x: 20, y: 3, s: 1.0, rx: 48, rz: 5 },
      { p: 0.64, x: 20, y: 6, s: 0.96, rx: 56, rz: 3 },
      { p: 0.78, x: 20, y: 2, s: 0.96, rx: 44, rz: -5 },
      { p: 1.00, x: 19, y: -1, s: 1.06, rx: 30, rz: -2 }
    ];
    function pose(p) {
      var i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
      var a = KEYS[i], b = KEYS[i + 1], t = smooth(a.p, b.p, p);
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s: lerp(a.s, b.s, t), rx: lerp(a.rx, b.rx, t), rz: lerp(a.rz, b.rz, t) };
    }

    var target = 0, p = 0, mx = 0, my = 0, smx = 0, smy = 0, last = performance.now(), visible = true;
    function read() { var r = root.getBoundingClientRect(); target = clamp(-r.top / ((r.height - window.innerHeight) || 1)); }
    window.addEventListener('scroll', read, { passive: true }); read();
    window.addEventListener('pointermove', function (e) { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; }, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(root);

    function fmt(h) { var hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm; }

    function tick(now) {
      requestAnimationFrame(tick);
      var dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (!visible) return;
      p += (target - p) * (REDUCED ? 1 : Math.min(1, dt * 6));
      smx += (mx - smx) * Math.min(1, dt * 4); smy += (my - smy) * Math.min(1, dt * 4);
      var t = now / 1000;

      // scenes
      scenes.forEach(function (s) { var o = rangeOpacity(s.spec, p); s.el.style.opacity = o.toFixed(3); s.el.style.visibility = o < 0.005 ? 'hidden' : 'visible'; });
      inner.forEach(function (s) { var o = rangeOpacity(s.spec, p, 0.015); s.el.style.setProperty('--in', o.toFixed(3)); s.el.classList.toggle('is-in', o > 0.5); });

      // product pose
      if (float) {
        var mobile = window.innerWidth < 900, q = pose(p);
        var bob = REDUCED ? 0 : Math.sin(t * 1.1) * 8;
        var x = mobile ? 0 : q.x, y = mobile ? -17 + q.y * 0.3 : q.y;
        float.style.transform = 'translate3d(' + x + 'vw,calc(' + y + 'vh + ' + bob.toFixed(1) + 'px),0) scale(' + (q.s * (mobile ? 0.92 : 1)).toFixed(3) + ') rotateX(' + (q.rx - smy * 10).toFixed(2) + 'deg) rotateY(' + (smx * 14).toFixed(2) + 'deg) rotateZ(' + q.rz.toFixed(2) + 'deg)';
      }

      // mood
      var summer = smooth(0.78, 0.86, p);
      var night = smooth(0.48, 0.54, p) * (1 - smooth(0.62, 0.67, p));
      var overnightSnow = smooth(0.5, 0.6, p) * (1 - smooth(0.63, 0.66, p));
      var wipe = smooth(wipeR[0], wipeR[1], p);
      stage.style.setProperty('--summer', summer.toFixed(3));
      stage.style.setProperty('--night', night.toFixed(3));
      stage.style.setProperty('--cover-snow', overnightSnow.toFixed(3));
      stage.style.setProperty('--wipe', wipe.toFixed(4));
      root.classList.toggle('is-summer', summer > 0.5);
      if (snow) { snow.amount = (1 - summer) * (0.55 + night * 0.9 + smooth(0.14, 0.2, p) * 0.3 * (1 - smooth(0.29, 0.31, p))); snow.wind = night * 0.8 + smx * 0.6; snow.step(dt, t); }

      // chapters
      var best = 0, bi = 0;
      chapters.forEach(function (c, i) {
        var fin = c.from <= 0.001 ? 1 : smooth(c.from, c.from + 0.025, p);
        var fout = c.to >= 0.999 ? 1 : 1 - smooth(c.to - 0.025, c.to, p);
        var o = fin * fout;
        c.el.style.opacity = o.toFixed(3);
        c.el.style.transform = 'translate3d(0,' + ((1 - fin) * 46 - (1 - fout) * 46).toFixed(1) + 'px,0)';
        c.el.style.filter = o < 0.99 ? 'blur(' + ((1 - o) * 8).toFixed(1) + 'px)' : 'none';
        c.el.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
        if (o > best) { best = o; bi = i; }
      });
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === bi); });

      // HUD
      var temp = '-12°C', time = '22:00', glass = 'Clear', label = 'Tonight';
      if (p < 0.13) { time = '21:58'; glass = 'Clear'; label = 'Tonight −12°C'; }
      else if (p < 0.30) { time = '07:00'; glass = 'Frozen'; label = 'Without cover'; }
      else if (p < 0.49) { time = '22:00'; glass = 'Covered'; label = 'With Frostveil'; }
      else if (p < 0.64) { time = fmt(22 + smooth(0.49, 0.64, p) * 9); glass = 'Protected'; label = 'Overnight'; temp = Math.round(-12 - smooth(0.49, 0.6, p) * 4) + '°C'; }
      else if (p < 0.78) { time = '07:00'; glass = wipe > 0.5 ? 'Clear ✓' : 'Peeling…'; label = 'Morning'; temp = '-16°C'; }
      else { temp = Math.round(lerp(-16, 34, summer)) + '°C'; time = '14:00'; glass = 'Shaded'; label = 'Summer'; }
      if (hud.temp) hud.temp.textContent = temp;
      if (hud.time) hud.time.textContent = time;
      if (hud.glass) hud.glass.textContent = glass;
      if (hud.label) hud.label.textContent = label;
    }
    requestAnimationFrame(tick);
    root.classList.add('is-ready');
  }

  /* ---------------- Layer stack (CSS 3D) ---------------- */
  function initLayers(root) {
    var stage = root.querySelector('.layers__stage'), stack = root.querySelector('[data-stack]');
    var sheets = $$('.sheet', root), items = $$('[data-layer-item]', root);
    var target = 0, q = 0, last = performance.now(), mx = 0, my = 0;
    function read() {
      var r = root.getBoundingClientRect(), vh = window.innerHeight;
      var sticky = getComputedStyle(stage).position === 'sticky';
      target = sticky ? clamp(-r.top / ((r.height - vh) || 1)) : clamp((vh * 0.9 - r.top) / (r.height + vh * 0.1));
    }
    window.addEventListener('scroll', read, { passive: true }); read();
    root.addEventListener('pointermove', function (e) { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; });
    (function tick(now) {
      requestAnimationFrame(tick);
      var dt = Math.min((now - last) / 1000, 0.05); last = now;
      q += (target - q) * (REDUCED ? 1 : Math.min(1, dt * 6));
      var explode = smooth(0.02, 0.3, q);
      var active = q < 0.3 ? -1 : Math.min(2, Math.floor((q - 0.3) / 0.7 * 3));
      stack.style.setProperty('--explode', explode.toFixed(3));
      stack.style.setProperty('--tilt-x', (my * -8).toFixed(2) + 'deg');
      stack.style.setProperty('--tilt-z', (mx * 10).toFixed(2) + 'deg');
      sheets.forEach(function (s, i) { s.classList.toggle('is-active', i === active); });
      items.forEach(function (el, i) { el.classList.toggle('is-active', i === active); });
    })(last);
  }

  /* ---------------- Before / after slider ---------------- */
  function initCompare(el) {
    var range = el.querySelector('.compare__range');
    var set = function (v) { el.style.setProperty('--pos', v + '%'); };
    range.addEventListener('input', function () { set(range.value); });
    // gentle intro sweep once visible
    if ('IntersectionObserver' in window && !REDUCED) {
      var io = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return; io.disconnect();
        var start = performance.now();
        (function a(now) {
          var t = clamp((now - start) / 1800);
          var v = 50 + Math.sin(t * Math.PI * 2) * 30 * (1 - t);
          set(v.toFixed(1)); range.value = v;
          if (t < 1) requestAnimationFrame(a);
        })(start);
      }, { threshold: 0.6 });
      io.observe(el);
    }
  }

  function boot() {
    $$('[data-story]').forEach(initStory);
    $$('[data-layers]').forEach(initLayers);
    $$('[data-compare-slider]').forEach(initCompare);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
