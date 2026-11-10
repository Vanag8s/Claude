/* Coast landing page. No dependencies. */
(() => {
  "use strict";

  // ---------- Config: edit these ----------
  const CONFIG = {
    APP_URL: "https://dvai-rebranding-and-2jqh.bolt.host", // your live app (sign in / trial). Replace with your own domain.
    CONTACT_EMAIL: "coastagencyai@gmail.com",               // replace with hello@yourdomain once you have it
    LEGAL: { privacy: "#", terms: "#", dpa: "#" },          // links to your policy pages
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- Links ----------
  $$("[data-app]").forEach((a) => { a.href = CONFIG.APP_URL; });
  $$("[data-mail]").forEach((a) => { a.href = a.href.replace(/mailto:[^?]+/, "mailto:" + CONFIG.CONTACT_EMAIL); });
  $$("[data-legal]").forEach((a) => { a.href = CONFIG.LEGAL[a.dataset.legal] || "#"; });
  $("#year").textContent = new Date().getFullYear();

  // ---------- i18n ----------
  const LT = {
    "nav.how": "Kaip tai veikia", "nav.features": "Galimybės", "nav.trust": "Patikimumas", "nav.pricing": "Kainos", "nav.faq": "DUK", "nav.signin": "Prisijungti",
    "hero.pill": "Laisvai samdomiems ir agentūroms, valdančioms daug prekės ženklų",
    "hero.title": "Pirmadienis <em>be streso.</em>",
    "hero.lead": "Parašykite visos savaitės įrašus kiekvienam klientui — jo paties balsu, lietuviškai ar angliškai — ir gaukite patvirtinimą viena nuoroda, kurią klientas atsidaro telefone.",
    "cta.trial": "Išbandyti 14 dienų", "cta.watch": "Pažiūrėti, kaip veikia",
    "hero.note": "Kortelės nereikia · Atšaukite bet kada · Planai nuo 15 €/mėn.",
    "problem.eyebrow": "Sekmadienio vakaro problema",
    "problem.title": "Pokalbių langas — dar ne turinio procesas.",
    "problem.lead": "Tekstų gausite iš bet kurio DI. Laikas dingsta kitur: kas savaitę iš naujo aiškinant apie klientą, taisant „beveik tą“ balsą ir laukiant patvirtinimų per WhatsApp.",
    "problem.beforeTitle": "Šiandien",
    "problem.b1": "Kiekvieno kliento aprašymą kas savaitę kopijuojate į pokalbį",
    "problem.b2": "Tekstai skamba kaip DI, o ne kaip klientas",
    "problem.b3": "Ekrano nuotraukos WhatsApp'e, „ar tinka?“, laukimas",
    "problem.b4": "Įrašai po vieną kopijuojami į planuoklį",
    "problem.afterTitle": "Su Coast",
    "problem.a1": "Kiekvieno kliento balsas išsaugomas vieną kartą — išmoktas iš tikrų jo įrašų",
    "problem.a2": "Visa savaitė klientui iš vieno paprasto aprašymo",
    "problem.a3": "Viena patvirtinimo nuoroda — klientas telefone paspaudžia ✓",
    "problem.a4": "Patvirtinta savaitė vienu paspaudimu eksportuojama į planuoklį",
    "how.eyebrow": "Kaip tai veikia", "how.title": "Nuo chaotiško aprašymo iki patvirtintos savaitės.",
    "how.s1t": "Išmokykite balso", "how.s1p": "Pridėkite klientą: tonas, auditorija, žodžiai, kuriuos naudoti ir kurių vengti, bei keli geriausi jo įrašai.",
    "how.s2t": "Užduotį pateikite kaip kolegai", "how.s2p": "„Savaitės įrašai kavinei, rudens meniu, šiltai ir vietiškai.“ Tekstai, idėjos ir Reels scenarijai — to kliento balsu.",
    "how.s3t": "Išsiųskite vieną patvirtinimo nuorodą", "how.s3p": "Klientas ją atsidaro iš WhatsApp ar el. laiško — be prisijungimo — ir patvirtina arba pakomentuoja kiekvieną įrašą.",
    "how.s4t": "Eksportuokite į planuoklį", "how.s4p": "Patvirtinta savaitė eksportuojama CSV failu masiniam įkėlimui ir atsiranda Coast kalendoriuje.",
    "badge.beta": "Steigėjų beta",
    "demo.example": "· pavyzdinis klientas", "demo.warmth": "Šiltumas", "demo.local": "Vietinis jausmas",
    "demo.c1": "trumpi sakiniai", "demo.c2": "jusliniai žodžiai", "demo.c3": "ne daugiau 1 jaustuko", "demo.c4": "niekada „nuostabu“",
    "demo.p2": "„Lauke lyja, viduje — cinamonas. Jūsų kampinis staliukas laisvas.“",
    "demo.ask": "Savaitės įrašai Kopai — rudens meniu, šiltai ir vietiškai. Maišyk LT ir EN.",
    "demo.cap2": "Reel: 15 s — garai virš puodelio, pro langą kopos. Kabliukas: „Štai kaip čia kvepia 8 ryto.“",
    "demo.approveCopy": "Klientas peržiūri savaitę ir patvirtina kiekvieną įrašą. Komentarai grįžta jums — prie reikiamo įrašo.",
    "demo.phoneTitle": "Kopa · 46 savaitė", "demo.ap1": "Pr · Moliūgų sriuba", "demo.ap2": "Tr · Reel: 8 ryto", "demo.ap3": "Pn · Savaitgalis", "demo.ap4": "Sk · Istorijos apklausa",
    "demo.posts4": "4 patvirtinti įrašai", "demo.scheduler": "Jūsų planuoklis",
    "demo.exportCopy": "Įkelkite į planuoklį, kurį jau naudojate. Coast jo nepakeičia — jį užpildo.",
    "feat.eyebrow": "Sukurta daugeliui prekės ženklų", "feat.title": "Viskas, ko reikia savaitei su daug klientų. Nieko nereikalingo.",
    "feat.f1t": "Atskiras balsas kiekvienam klientui", "feat.f1p": "Tonas, auditorija, naudotini ir vengtini žodžiai — išsaugoti vieną kartą ir taikomi kiekvienai užklausai, todėl odontologijos klinika niekada neskambės kaip gatvės mados ženklas.",
    "feat.f2t": "Lietuviškai ir angliškai", "feat.f2p": "Rašykite natūraliai bet kuria kalba arba maišykite jas per savaitę. Jokio „išversto“ skambesio.",
    "feat.f3t": "Klientų patvirtinimai", "feat.f3p": "Viena nuoroda savaitei. Klientai tvirtina ar komentuoja telefone. Be paskyrų, be ekrano nuotraukų.",
    "feat.f4t": "Kalendorius kiekvienam klientui", "feat.f4p": "Kiekvieno ženklo mėnuo vienu žvilgsniu. Žymėkite juodraščius, patvirtintus ir paskelbtus.",
    "feat.f5t": "Eksportas į planuoklį", "feat.f5p": "Patvirtinti įrašai CSV failu — masiniam įkėlimui į planuoklį, už kurį jau mokate.",
    "feat.f6t": "Fiksuota kaina, sąžiningas naudojimas", "feat.f6p": "Jokių kreditų, pasibaigiančių mėnesio viduryje. Dosnus limitas — apie 1 500 DI užklausų paskyrai.",
    "trust.eyebrow": "Kas kuria Coast", "trust.title": "Kuria tikras žmogus, prie Baltijos.",
    "trust.lead": "Coast — nepriklausomas produktas, kuriamas Nidoje. Galite rašyti tiesiai įkūrėjui — ir atsakys žmogus, ne robotas.",
    "trust.t1": "Jūsų klientai lieka privatūs", "trust.t1p": "Eilučių lygio apsauga reiškia, kad prie jūsų klientų ir turinio prieina tik jūsų paskyra.",
    "trust.t2": "Duomenys ES, be mokymo", "trust.t2p": "Klientų duomenys saugomi ES ir nenaudojami DI modeliams mokyti. Duomenų tvarkymo sutartį pateiksime paprašius.",
    "trust.t3": "Kalbėkite su įkūrėju", "trust.t3p": "Steigėjams pirmųjų trijų klientų balsus nustatysime asmeniškai.",
    "price.eyebrow": "Kainos", "price.title": "Paprasti planai. Pirmiausia išbandykite su tikrais klientais.",
    "price.lead": "14 dienų nemokamai, be kortelės. Tada pasirinkite planą pagal klientų skaičių.",
    "price.monthly": "Kas mėnesį", "price.yearly": "Kas metus", "price.save": "2 mėn. dovanų",
    "price.foundT": "Steigėjams: Studio už 19 €/mėn.", "price.foundP": "Tik pirmoms 50 paskyrų. Kaina užfiksuota 12 mėnesių, o pirmųjų 3 klientų balsus nustatysime asmeniškai.",
    "price.foundCta": "Užimti steigėjo vietą",
    "price.soloFor": "Pradedantiems laisvai samdomiems", "price.studioFor": "Užimtiems laisvai samdomiems ir mažoms komandoms", "price.agencyFor": "Komandoms su daug prekės ženklų",
    "price.per": "/mėn.", "price.perYear": "/metus",
    "price.c5": "Iki 5 klientų", "price.c15": "Iki 15 klientų", "price.unlimited": "Neribotas klientų skaičius",
    "price.voices": "Balso profilis kiekvienam klientui", "price.lang": "Lietuvių + anglų kalbos", "price.cal": "Turinio kalendorius",
    "price.everything": "Viskas, kas Solo plane", "price.everythingS": "Viskas, kas Studio plane",
    "price.approvals": "Klientų patvirtinimo nuorodos", "price.export": "CSV eksportas į planuoklį", "price.seats": "3 komandos vietos", "price.priority": "Prioritetinė pagalba",
    "price.start": "Pradėti nemokamai", "price.popular": "Populiariausias",
    "price.guarT": "Balso garantija", "price.guarP": "Jei klientas atmeta balsą per pirmą mokamą mėnesį, grąžinsime pinigus už tą mėnesį. Be formų — tiesiog atsakykite į kvitą.",
    "price.fine": "Kainos nurodytos be PVM, kai jis taikomas. Sąžiningas naudojimas: apie 1 500 DI užklausų paskyrai per mėnesį.",
    "faq.eyebrow": "DUK", "faq.title": "Ko agentūros klausia pirmiausia.",
    "faq.q1": "Jau naudoju ChatGPT arba Claude. Kam man Coast?", "faq.a1": "Palikite juos idėjoms. Coast — tai procesas aplink rašymą: išsaugotas balsas ir kalendorius kiekvienam klientui, visa savaitė iš vieno aprašymo, patvirtinimo nuoroda klientui ir eksportas į planuoklį. Būtent tai, ką pokalbių langas palieka jums.",
    "faq.q2": "Ar Coast skelbia į Instagram ar TikTok?", "faq.a2": "Ne — sąmoningai. Pasiliekate planuoklį, kuriuo pasitikite. Coast jį užpildo patvirtintais įrašais per CSV eksportą.",
    "faq.q3": "Kaip gerai jis rašo lietuviškai?", "faq.a3": "Coast rašo natūraliai lietuvių ir anglų kalbomis. Įvertinkite su savo klientais: per 14 dienų spėsite paruošti du tikrus pirmadienius.",
    "faq.q4": "Ar klientams reikia paskyros patvirtinimui?", "faq.a4": "Ne. Jie atsidaro nuorodą telefone ir kiekvieną įrašą patvirtina arba pakomentuoja.",
    "faq.q5": "Kas nutinka mano turiniui, jei išeinu?", "faq.a5": "Prieš išeidami viską eksportuokite CSV failu. Uždarius paskyrą, jūsų duomenys ištrinami.",
    "faq.q6": "Ar galiu atšaukti bet kada?", "faq.a6": "Taip. Mėnesiniai planai baigiasi laikotarpio pabaigoje — nieko derėtis nereikia.",
    "final.title": "Pirmadienį — į paplūdimį, ne prie tuščio lapo.", "final.lead": "Pirmąjį klientą nustatysite per penkias minutes. Išbandykite tikrą savaitę prieš mokėdami.",
    "final.pilot": "Klausti apie steigėjų pilotą",
    "foot.about": "Kiekvieno kliento balsu parašytas turinys, patvirtinamas viena nuoroda. Sukurta Nidoje.",
    "foot.product": "Produktas", "foot.company": "Įmonė", "foot.legal": "Teisinė informacija", "foot.contact": "Kontaktai",
    "foot.privacy": "Privatumo politika", "foot.terms": "Naudojimo sąlygos", "foot.dpa": "Duomenų tvarkymas (DPA)", "foot.note": "Turinys lieka privatus jūsų paskyroje. Atšaukite bet kada.",
  };
  const EN = {};
  $$("[data-i18n]").forEach((el) => { EN[el.dataset.i18n] = el.textContent; });
  $$("[data-i18n-html]").forEach((el) => { EN[el.dataset.i18nHtml] = el.innerHTML; });
  EN["price.perYear"] = "/year";
  const dict = { en: EN, lt: LT };
  let lang = "en";

  function splitWords(el) {
    if (reduceMotion) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = el.innerHTML;
    const out = [];
    let i = 0;
    const walk = (node, wrapEm) => {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) { out.push(" "); return; }
            const inner = wrapEm ? "<em>" + w + "</em>" : w;
            out.push('<span class="word"><span style="animation-delay:' + (0.35 + i++ * 0.09).toFixed(2) + 's">' + inner + "</span></span>");
          });
        } else if (n.nodeType === 1) walk(n, n.tagName === "EM");
      });
    };
    walk(tmp, false);
    el.innerHTML = out.join("");
  }

  function setLang(next) {
    lang = next;
    document.documentElement.lang = next;
    const d = dict[next];
    $$("[data-i18n]").forEach((el) => { const v = d[el.dataset.i18n] ?? EN[el.dataset.i18n]; if (v != null) el.textContent = v; });
    $$("[data-i18n-html]").forEach((el) => { const v = d[el.dataset.i18nHtml] ?? EN[el.dataset.i18nHtml]; if (v != null) el.innerHTML = v; });
    $$("[data-split]").forEach(splitWords);
    $$(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === next)));
    applyBilling();
    try { localStorage.setItem("coast-lang", next); } catch (e) { /* storage unavailable */ }
    typedDone = false;
  }
  $$(".lang button").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));

  // ---------- Billing toggle ----------
  let billing = "month";
  function applyBilling() {
    $$(".plan .amt").forEach((el) => { el.textContent = "€" + (billing === "year" ? el.dataset.priceYear : el.dataset.priceMonth); });
    const per = dict[lang][billing === "year" ? "price.perYear" : "price.per"] || EN["price.per"];
    $$(".plan .per").forEach((el) => { el.textContent = per; });
    $$("[data-billing]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.billing === billing)));
  }
  $$("[data-billing]").forEach((b) => b.addEventListener("click", () => { billing = b.dataset.billing; applyBilling(); }));

  // ---------- Nav ----------
  const nav = $("#nav");
  const menuBtn = $("#menuBtn"), navLinks = $("#navLinks");
  menuBtn.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  navLinks.addEventListener("click", (e) => { if (e.target.closest("a")) { navLinks.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); } });

  // ---------- Reveal on scroll ----------
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal").forEach((el) => io.observe(el));

  // ---------- Hero: stars ----------
  const stars = $("#stars"), sctx = stars.getContext("2d");
  let starList = [];
  function sizeStars() {
    const r = stars.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    stars.width = r.width * dpr; stars.height = r.height * dpr; sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    starList = Array.from({ length: Math.round(r.width / 9) }, () => ({ x: Math.random() * r.width, y: Math.random() * r.height * 0.8, r: Math.random() * 1.2 + 0.2, p: Math.random() * Math.PI * 2 }));
  }

  // ---------- Hero: sea (layered sine waves) ----------
  const sea = $("#sea"), ctx = sea.getContext("2d");
  let W = 0, H = 0;
  const layers = [
    { amp: 10, len: 0.006, speed: 0.35, y: 0.18, color: "rgba(127, 190, 190, 0.55)" },
    { amp: 14, len: 0.0045, speed: -0.25, y: 0.34, color: "rgba(64, 140, 145, 0.7)" },
    { amp: 18, len: 0.0035, speed: 0.2, y: 0.52, color: "rgba(31, 102, 112, 0.85)" },
    { amp: 22, len: 0.0028, speed: -0.15, y: 0.7, color: "rgba(18, 70, 86, 0.95)" },
  ];
  function sizeSea() {
    const r = sea.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height; sea.width = W * dpr; sea.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawSea(t) {
    ctx.clearRect(0, 0, W, H);
    // sun glitter path
    const gx = W * 0.68;
    const g = ctx.createLinearGradient(gx - 120, 0, gx + 120, 0);
    g.addColorStop(0, "rgba(255,220,160,0)"); g.addColorStop(0.5, "rgba(255,220,160,0.35)"); g.addColorStop(1, "rgba(255,220,160,0)");
    layers.forEach((L, idx) => {
      const base = H * L.y;
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 10; x += 10) {
        const y = base + Math.sin(x * L.len + t * L.speed) * L.amp + Math.sin(x * L.len * 2.3 - t * L.speed * 1.7) * L.amp * 0.35;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = L.color; ctx.fill();
      if (idx === 0) { ctx.fillStyle = g; ctx.fill(); }
      // foam crest
      ctx.beginPath();
      for (let x = 0; x <= W + 10; x += 10) {
        const y = base + Math.sin(x * L.len + t * L.speed) * L.amp + Math.sin(x * L.len * 2.3 - t * L.speed * 1.7) * L.amp * 0.35;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(230, 250, 246," + (0.35 - idx * 0.07) + ")"; ctx.lineWidth = 1.2; ctx.stroke();
    });
    // twinkle
    const sr = stars.getBoundingClientRect();
    sctx.clearRect(0, 0, sr.width, sr.height);
    starList.forEach((s) => {
      sctx.globalAlpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.p));
      sctx.beginPath(); sctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); sctx.fillStyle = "#fff"; sctx.fill();
    });
    sctx.globalAlpha = 1;
  }

  let heroVisible = true;
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }, { threshold: 0 }).observe($(".hero"));
  function loop(ms) {
    if (heroVisible) drawSea(ms / 1000);
    requestAnimationFrame(loop);
  }
  function sizeAll() { sizeSea(); sizeStars(); drawSea(0); }
  sizeAll();
  window.addEventListener("resize", sizeAll);
  if (!reduceMotion) requestAnimationFrame(loop);

  // ---------- Scroll: nav state, parallax, demo ----------
  const sun = $("#sun");
  const dunePaths = $$("#dunes path");
  const heroContent = $(".hero-content");
  const scroller = $("#demoScroller");
  const steps = $$(".demo-step"), scenes = $$(".scene"), progress = $("#demoProgress");
  let current = -1;
  const isMobile = () => window.matchMedia("(max-width: 960px)").matches;

  function setStep(i) {
    if (i === current) return;
    current = i;
    steps.forEach((s, k) => s.classList.toggle("active", k === i));
    scenes.forEach((s, k) => s.classList.toggle("active", k === i));
    if (i === 1) runTyping();
    if (i === 2) runApprovals();
  }
  steps.forEach((s) => s.addEventListener("click", () => {
    const i = Number(s.dataset.step);
    if (isMobile()) { setStep(i); return; }
    const top = scroller.getBoundingClientRect().top + scrollY;
    const span = scroller.offsetHeight - innerHeight;
    scrollTo({ top: top + span * ((i + 0.5) / steps.length), behavior: reduceMotion ? "auto" : "smooth" });
  }));

  let ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = scrollY;
      nav.classList.toggle("scrolled", y > 40);
      if (!reduceMotion && y < innerHeight * 1.2) {
        sun.style.transform = "translate(-50%, calc(-50% + " + y * 0.35 + "px))";
        dunePaths.forEach((p) => { p.style.transform = "translateY(" + (-y * parseFloat(p.dataset.depth || 0)) + "px)"; });
        heroContent.style.transform = "translateY(" + y * 0.18 + "px)";
        heroContent.style.opacity = String(Math.max(0, 1 - y / (innerHeight * 0.8)));
      }
      if (!isMobile()) {
        const r = scroller.getBoundingClientRect();
        const span = scroller.offsetHeight - innerHeight;
        const p = Math.min(1, Math.max(0, -r.top / span));
        progress.style.height = p * 100 + "%";
        setStep(Math.min(steps.length - 1, Math.floor(p * steps.length)));
      }
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // mobile: auto-advance demo when visible
  let autoTimer = null;
  new IntersectionObserver(([e]) => {
    clearInterval(autoTimer);
    if (e.isIntersecting && isMobile()) {
      if (current < 0) setStep(0);
      autoTimer = setInterval(() => setStep((current + 1) % steps.length), 4200);
    }
  }, { threshold: 0.4 }).observe($(".screen"));

  // ---------- Demo: typing + captions ----------
  let typedDone = false, typeTimer = null;
  function runTyping() {
    const el = $("#typed"), caps = $$("#captionList .caption");
    clearInterval(typeTimer);
    const text = lang === "lt" ? "Štai savaitė Kopai, jos balsu:" : "Here's Kopa's week, in Kopa's own voice:";
    if (typedDone || reduceMotion) { el.textContent = text; el.classList.add("done"); caps.forEach((c) => c.classList.add("show")); return; }
    el.textContent = ""; el.classList.remove("done"); caps.forEach((c) => c.classList.remove("show"));
    let k = 0;
    typeTimer = setInterval(() => {
      el.textContent = text.slice(0, ++k);
      if (k >= text.length) {
        clearInterval(typeTimer); el.classList.add("done"); typedDone = true;
        caps.forEach((c, j) => setTimeout(() => c.classList.add("show"), 250 + j * 380));
      }
    }, 32);
  }

  // ---------- Demo: approvals ticking ----------
  let apTimers = [];
  function runApprovals() {
    apTimers.forEach(clearTimeout); apTimers = [];
    const items = $$("#phoneList .ap");
    items.forEach((a) => a.classList.remove("yes"));
    items.forEach((a, j) => apTimers.push(setTimeout(() => a.classList.add("yes"), reduceMotion ? 0 : 500 + j * 550)));
  }

  // ---------- Card tilt + spotlight ----------
  if (!reduceMotion && matchMedia("(hover: hover)").matches) {
    $$(".tilt").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty("--mx", px * 100 + "%"); card.style.setProperty("--my", py * 100 + "%");
        card.style.transform = "perspective(900px) rotateX(" + (0.5 - py) * 6 + "deg) rotateY(" + (px - 0.5) * 8 + "deg) translateY(-4px)";
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    });
    $$(".magnetic").forEach((b) => {
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        b.style.transform = "translate(" + (e.clientX - r.left - r.width / 2) * 0.18 + "px," + (e.clientY - r.top - r.height / 2) * 0.3 + "px)";
      });
      b.addEventListener("pointerleave", () => { b.style.transform = ""; });
    });
  }

  // ---------- Init language ----------
  let saved = null;
  try { saved = localStorage.getItem("coast-lang"); } catch (e) { /* ignore */ }
  const initial = saved || ((navigator.language || "").toLowerCase().startsWith("lt") ? "lt" : "en");
  setLang(initial);
})();
