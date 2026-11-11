/* Frostveil theme – UI, motion & AJAX cart (no dependencies) */
(function () {
  'use strict';
  var F = window.Frost || {};
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var smooth = function (e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------------- Money ---------------- */
  function formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    format = format || F.moneyFormat || '${{amount}}';
    var re = /\{\{\s*(\w+)\s*\}\}/;
    function withDelims(n, prec, thou, dec) {
      thou = thou || ','; dec = dec || '.';
      if (isNaN(n) || n == null) return 0;
      n = (n / 100.0).toFixed(prec);
      var parts = n.split('.');
      return parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thou) + (parts[1] ? dec + parts[1] : '');
    }
    var m = format.match(re), v = '';
    switch (m ? m[1] : 'amount') {
      case 'amount_no_decimals': v = withDelims(cents, 0); break;
      case 'amount_with_comma_separator': v = withDelims(cents, 2, '.', ','); break;
      case 'amount_no_decimals_with_comma_separator': v = withDelims(cents, 0, '.', ','); break;
      case 'amount_with_apostrophe_separator': v = withDelims(cents, 2, "'", '.'); break;
      default: v = withDelims(cents, 2);
    }
    return format.replace(re, v);
  }
  F.formatMoney = formatMoney;

  /* ---------------- Header ---------------- */
  var header = $('[data-header]');
  var lastY = 0;
  function onScrollHeader() {
    var y = window.scrollY;
    if (header) {
      header.classList.toggle('is-scrolled', y > 40);
      header.classList.toggle('is-hidden', y > lastY && y > 600);
    }
    lastY = y;
  }
  window.addEventListener('scroll', onScrollHeader, { passive: true }); onScrollHeader();

  /* ---------------- Reveal on scroll ---------------- */
  if ('IntersectionObserver' in window && !REDUCED) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    $$('[data-reveal]').forEach(function (el) { io.observe(el); });
  } else {
    $$('[data-reveal]').forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------------- Count-up numbers ---------------- */
  var cio = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target);
      var el = e.target, to = parseFloat(el.getAttribute('data-count-to')) || 0, start = performance.now(), dur = 1400;
      (function tick(now) {
        var t = clamp((now - start) / dur, 0, 1), eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(to * eased);
        if (t < 1) requestAnimationFrame(tick);
      })(start);
    });
  }, { threshold: 0.6 }) : null;
  $$('[data-count-to]').forEach(function (el) { if (cio && !REDUCED) cio.observe(el); else el.textContent = el.getAttribute('data-count-to'); });

  /* ---------------- 3D tilt cards ---------------- */
  if (!REDUCED && window.matchMedia('(hover: hover)').matches) {
    $$('[data-tilt]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--rx', (-y * 10).toFixed(2) + 'deg');
        el.style.setProperty('--ry', (x * 12).toFixed(2) + 'deg');
        el.style.setProperty('--mx', ((x + 0.5) * 100).toFixed(1) + '%');
        el.style.setProperty('--my', ((y + 0.5) * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
    $$('[data-magnetic]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.25) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.35) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* ---------------- Parallax image + install progress ---------------- */
  var par = $$('.coverage__img');
  var steps = $('[data-install]'), stepBar = $('[data-install-progress]');
  function onScrollFx() {
    var vh = window.innerHeight;
    par.forEach(function (img) {
      var r = img.parentElement.getBoundingClientRect();
      var k = clamp((vh - r.top) / (vh + r.height), 0, 1);
      img.style.transform = 'scale(1.12) translate3d(0,' + ((k - 0.5) * -40).toFixed(1) + 'px,0)';
    });
    if (steps && stepBar) {
      var r = steps.getBoundingClientRect();
      stepBar.style.transform = 'scaleX(' + clamp((vh * 0.75 - r.top) / (r.height), 0, 1).toFixed(3) + ')';
    }
  }
  if (!REDUCED) { window.addEventListener('scroll', onScrollFx, { passive: true }); onScrollFx(); }

  /* ---------------- Season switcher ---------------- */
  $$('[data-seasons]').forEach(function (sec) {
    $$('[data-season-btn]', sec).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-season-btn');
        sec.setAttribute('data-season', key);
        $$('[data-season-btn]', sec).forEach(function (b) { b.setAttribute('aria-selected', b === btn ? 'true' : 'false'); });
        $$('[data-season-panel]', sec).forEach(function (p) { p.hidden = p.getAttribute('data-season-panel') !== key; });
      });
    });
  });

  /* ---------------- Coverage zones + hotspots ---------------- */
  $$('.coverage').forEach(function (sec) {
    function activate(i) {
      $$('[data-zone]', sec).forEach(function (z) { z.classList.toggle('is-active', z.getAttribute('data-zone') === String(i)); });
      $$('[data-hotspot]', sec).forEach(function (h) { h.classList.toggle('is-active', h.getAttribute('data-hotspot') === String(i)); });
    }
    $$('[data-zone-btn]', sec).forEach(function (b) { b.addEventListener('click', function () { activate(b.getAttribute('data-zone-btn')); }); });
    $$('[data-hotspot]', sec).forEach(function (b) { b.addEventListener('click', function () { activate(b.getAttribute('data-hotspot')); }); });
    activate(0);
  });

  /* ---------------- Gallery ---------------- */
  $$('[data-gallery]').forEach(function (g) {
    var imgs = $$('.gallery__img', g), thumbs = $$('[data-gallery-thumb]', g);
    function show(i) {
      imgs.forEach(function (im, k) { im.classList.toggle('is-active', k === i); });
      thumbs.forEach(function (t, k) { t.classList.toggle('is-active', k === i); });
    }
    thumbs.forEach(function (t, i) { t.addEventListener('click', function () { show(i); }); });
    show(0);
    g._show = show;
  });

  /* ---------------- Product form: variants, qty ---------------- */
  $$('[data-product-form]').forEach(function (form) {
    var jsonEl = $('[data-product-json]', form);
    var product = jsonEl ? JSON.parse(jsonEl.textContent) : null;
    var idInput = $('[data-variant-id]', form);
    var addBtn = $('[data-add-btn]', form), addLabel = $('[data-add-label]', form);
    var section = form.closest('[data-buy]');

    function currentOptions() {
      return $$('[data-option-index]', form).map(function (fs) {
        var c = $('input:checked', fs); return c ? c.value : null;
      });
    }
    function update() {
      if (!product) return;
      var opts = currentOptions();
      var v = product.variants.find(function (vr) { return vr.options.every(function (o, i) { return opts[i] == null || o === opts[i]; }); });
      $$('[data-option-index]', form).forEach(function (fs, i) { var lab = $('[data-option-value]', fs); if (lab) lab.textContent = opts[i]; });
      if (!v) { addBtn.disabled = true; addLabel.textContent = 'Unavailable'; return; }
      idInput.value = v.id;
      addBtn.disabled = !v.available; addLabel.textContent = v.available ? 'Add to cart' : 'Sold out';
      $$('[data-price]').forEach(function (el) { el.textContent = formatMoney(v.price); });
      var cmp = $('[data-compare]', section), save = $('[data-save]', section);
      if (cmp && save) {
        var on = v.compare_at_price && v.compare_at_price > v.price;
        cmp.hidden = save.hidden = !on;
        if (on) { cmp.textContent = formatMoney(v.compare_at_price); save.textContent = 'Save ' + formatMoney(v.compare_at_price - v.price); }
      }
      if (v.featured_image && product.images) {
        var idx = product.images.findIndex(function (src) { return String(src).split('?')[0].split('/').pop() === String(v.featured_image.src).split('?')[0].split('/').pop(); });
        var gal = section && $('[data-gallery]', section);
        if (idx >= 0 && gal && gal._show) gal._show(idx);
      }
      if (window.history.replaceState && !F.preview && /\/products\//.test(location.pathname)) {
        var url = new URL(location.href); url.searchParams.set('variant', v.id); history.replaceState({}, '', url.toString());
      }
    }
    $$('[data-option-index] input', form).forEach(function (inp) { inp.addEventListener('change', update); });

    var qty = $('[data-qty] input', form);
    $$('[data-qty-minus]', form).forEach(function (b) { b.addEventListener('click', function () { qty.value = Math.max(1, (+qty.value || 1) - 1); }); });
    $$('[data-qty-plus]', form).forEach(function (b) { b.addEventListener('click', function () { qty.value = Math.min(10, (+qty.value || 1) + 1); }); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('[data-form-error]', form); if (err) err.hidden = true;
      addBtn.classList.add('is-loading'); addBtn.disabled = true;
      Cart.add(+idInput.value, Math.max(1, +qty.value || 1)).then(function () {
        addLabel.textContent = 'Added ✓';
        Cart.open();
        setTimeout(function () { addLabel.textContent = 'Add to cart'; }, 1800);
      }).catch(function (ex) {
        if (err) { err.textContent = ex.message || 'Could not add to cart.'; err.hidden = false; }
      }).then(function () { addBtn.classList.remove('is-loading'); addBtn.disabled = false; });
    });
    update();
  });

  /* ---------------- Cart (AJAX API + drawer) ---------------- */
  var drawer = $('[data-cart-drawer]');
  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var mock = { items: [], item_count: 0, total_price: 0 };
  var Cart = {
    fetch: function () {
      if (F.preview) return Promise.resolve(mock);
      return fetch(root + 'cart.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); });
    },
    add: function (id, quantity) {
      if (F.preview) {
        var p = F.previewProduct, v = p && p.variants.find(function (x) { return x.id === id; });
        var line = mock.items.find(function (i) { return i.variant_id === id; });
        if (line) line.quantity += quantity;
        else mock.items.push({ key: String(id), variant_id: id, quantity: quantity, product_title: p.title, variant_title: v.title, final_price: v.price, image: p.featured_image, url: '#buy' });
        return Promise.resolve(recalc());
      }
      return fetch((F.routes && F.routes.cartAdd || '/cart/add') + '.js', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: id, quantity: quantity }] })
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.description || j.message); return j; }); });
    },
    change: function (key, quantity) {
      if (F.preview) {
        mock.items = mock.items.filter(function (i) { if (i.key === key) i.quantity = quantity; return i.quantity > 0; });
        return Promise.resolve(recalc());
      }
      return fetch((F.routes && F.routes.cartChange || '/cart/change') + '.js', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: key, quantity: quantity })
      }).then(function (r) { return r.json(); });
    },
    open: function () { Cart.render().then(function () { drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false'); document.documentElement.classList.add('lock'); }); },
    close: function () { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); document.documentElement.classList.remove('lock'); },
    render: function () {
      return Cart.fetch().then(function (cart) {
        $$('[data-cart-count]').forEach(function (el) { el.textContent = cart.item_count; el.classList.toggle('has-items', cart.item_count > 0); });
        var total = $('[data-cart-total]'); if (total) total.textContent = formatMoney(cart.total_price);
        var list = $('[data-cart-items]'); if (!list) return;
        if (!cart.items.length) { list.innerHTML = '<p class="muted">Your cart is empty.</p>'; return; }
        list.innerHTML = cart.items.map(function (i) {
          var img = i.image ? '<img src="' + String(i.image).replace(/(\.\w+)(\?|$)/, '$1$2') + '" alt="" width="72" height="72">' : '';
          var vt = i.variant_title && i.variant_title !== 'Default Title' ? '<span class="muted small">' + escapeHtml(i.variant_title) + '</span>' : '';
          return '<div class="drawer-line" data-key="' + escapeHtml(i.key) + '">' + img +
            '<div class="drawer-line__info"><a href="' + escapeHtml(i.url) + '">' + escapeHtml(i.product_title) + '</a>' + vt +
            '<span>' + formatMoney(i.final_price) + '</span></div>' +
            '<div class="drawer-line__qty"><button type="button" data-line-minus aria-label="Decrease">−</button><span>' + i.quantity + '</span><button type="button" data-line-plus aria-label="Increase">+</button></div></div>';
        }).join('');
      });
    }
  };
  function recalc() {
    mock.item_count = mock.items.reduce(function (a, i) { return a + i.quantity; }, 0);
    mock.total_price = mock.items.reduce(function (a, i) { return a + i.quantity * i.final_price; }, 0);
    return mock;
  }
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  window.FrostCart = Cart;

  if (drawer) {
    $$('[data-cart-open]').forEach(function (b) { b.addEventListener('click', Cart.open); });
    $$('[data-cart-close]', drawer).forEach(function (b) { b.addEventListener('click', Cart.close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') Cart.close(); });
    drawer.addEventListener('click', function (e) {
      var line = e.target.closest('[data-key]'); if (!line) return;
      var q = +line.querySelector('.drawer-line__qty span').textContent;
      if (e.target.closest('[data-line-minus]')) Cart.change(line.getAttribute('data-key'), q - 1).then(Cart.render);
      if (e.target.closest('[data-line-plus]')) Cart.change(line.getAttribute('data-key'), q + 1).then(Cart.render);
    });
    if (F.preview) { var chk = $('[data-checkout]'); if (chk) chk.addEventListener('click', function (e) { e.preventDefault(); chk.textContent = 'Preview – checkout runs on your Shopify store'; }); }
  }

  /* ---------------- Sticky mobile buy bar ---------------- */
  var sticky = $('[data-sticky-buy]'), buy = $('[data-buy]');
  if (sticky && buy && 'IntersectionObserver' in window) {
    var past = false;
    new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        past = e.boundingClientRect.top < 0 || window.scrollY > 900;
        var show = !e.isIntersecting && window.scrollY > 900;
        sticky.classList.toggle('is-visible', show);
        sticky.setAttribute('aria-hidden', show ? 'false' : 'true');
      });
    }, { threshold: 0 }).observe(buy);
  }

  /* ---------------- Snowfield (CTA) ---------------- */
  $$('[data-snowfield]').forEach(function (el) {
    var n = REDUCED ? 0 : 60, html = '';
    for (var i = 0; i < n; i++) {
      var s = (Math.random() * 3 + 1).toFixed(1);
      html += '<i style="left:' + (Math.random() * 100).toFixed(2) + '%;width:' + s + 'px;height:' + s + 'px;animation-duration:' + (6 + Math.random() * 10).toFixed(1) + 's;animation-delay:-' + (Math.random() * 12).toFixed(1) + 's;opacity:' + (0.3 + Math.random() * 0.7).toFixed(2) + '"></i>';
    }
    el.innerHTML = html;
  });
  $$('.seasons__flakes').forEach(function (el) {
    var html = '';
    for (var i = 0; i < 40; i++) html += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;animation-duration:' + (5 + Math.random() * 8).toFixed(1) + 's;animation-delay:-' + (Math.random() * 10).toFixed(1) + 's"></i>';
    el.innerHTML = html;
  });

  Cart.render();
})();
