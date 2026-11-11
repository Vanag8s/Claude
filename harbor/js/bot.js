/* Harbor demo assistant.
   1) If /api/chat is deployed (Claude-powered), free-form questions go there.
   2) Otherwise a local knowledge-base engine answers, so the demo always works.
   Booking runs as a guided flow (slots → name → phone → confirm) either way. */
(() => {
  const log = document.getElementById('botLog');
  const form = document.getElementById('botForm');
  const input = document.getElementById('botInput');
  if (!log) return;

  const KB = {
    company: 'Riverside Plumbing',
    areas: ['riverside', 'oakwood', 'maple heights', 'cedar park', 'lakeview', 'downtown', 'north hills'],
    prices: [
      { k: /drain|clog|unclog|backed? up/, t: 'Drain cleaning', p: '$149–$249', n: 'Most kitchen and bathroom drains are cleared in under an hour.' },
      { k: /water heater|hot water|boiler/, t: 'Water heater repair', p: '$189–$450 · replacement from $1,450', n: 'Tank and tankless, all major brands.' },
      { k: /toilet/, t: 'Toilet repair', p: '$129–$289', n: 'Running, leaking or clogged toilets.' },
      { k: /leak|pipe|burst/, t: 'Leak & pipe repair', p: '$175–$520', n: 'Includes leak detection with thermal camera.' },
      { k: /faucet|tap|sink/, t: 'Faucet & sink repair', p: '$119–$259', n: 'Install of your own fixture from $149.' },
      { k: /sewer|camera|main line/, t: 'Sewer camera inspection', p: '$249', n: 'Credited toward any sewer repair.' },
      { k: /remodel|bathroom|renovat|kitchen/, t: 'Remodel plumbing', p: 'Free on-site quote', n: 'A project lead visits, measures and quotes in writing.' }
    ],
    hours: 'Office: Mon–Sat 7 AM–7 PM. Emergencies: 24/7, 365 days.',
    fee: 'Diagnostic visit is $89 and gets waived if you go ahead with the repair. After-hours emergency call-out is $189.'
  };

  const state = { history: [], flow: null, booking: {}, api: null };
  const voice = { on: false, speak: () => {} };

  /* ---------- UI helpers ---------- */
  const scroll = () => (log.scrollTop = log.scrollHeight);
  const add = (text, who = 'ai', cls = '') => {
    const d = document.createElement('div');
    d.className = `msg msg--${who} ${cls}`; d.textContent = text;
    log.append(d); scroll();
    if (who !== 'me') { state.history.push({ role: 'assistant', content: text }); voice.speak(text); }
    return d;
  };
  const typing = () => {
    const d = document.createElement('div');
    d.className = 'msg msg--ai typing'; d.innerHTML = '<i></i><i></i><i></i>';
    d.setAttribute('aria-label', 'Harbor is typing');
    log.append(d); scroll(); return d;
  };
  const say = async (text, extra) => {
    const t = typing();
    await new Promise(r => setTimeout(r, Math.min(450 + text.length * 9, 1600)));
    t.remove();
    const m = add(text);
    if (extra) extra(m);
    return m;
  };
  const quick = opts => {
    const wrap = document.createElement('div'); wrap.className = 'quick';
    opts.forEach(o => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = o;
      b.onclick = () => { wrap.remove(); handle(o); };
      wrap.append(b);
    });
    log.append(wrap); scroll();
  };

  const slotsFor = () => {
    const out = [], d = new Date();
    const times = ['8:00 AM', '10:30 AM', '1:00 PM', '3:30 PM'];
    for (let i = 1; out.length < 6; i++) {
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
      if (day.getDay() === 0) continue;
      const label = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      out.push(`${label} · ${times[(i * 3 + out.length) % 4]}`);
      if (out.length % 2 === 1) out.push(`${label} · ${times[(i + out.length + 2) % 4]}`);
    }
    return out.slice(0, 6);
  };

  /* ---------- Booking flow ---------- */
  async function startBooking(reason) {
    state.flow = 'slot'; state.booking = { reason: reason || 'Service visit' };
    await say("Happy to get that booked. Here are the next open windows — tap one that works:", m => {
      const s = document.createElement('div'); s.className = 'slots';
      slotsFor().forEach(slot => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = slot;
        b.onclick = () => { s.remove(); handle(slot); };
        s.append(b);
      });
      m.append(s); scroll();
    });
  }
  async function bookingStep(text) {
    const b = state.booking;
    if (state.flow === 'slot') {
      b.slot = text; state.flow = 'name';
      return say(`${text} — great choice. What name should I put the booking under?`);
    }
    if (state.flow === 'name') {
      if (text.trim().length < 2) return say('Sorry, could you type your name?');
      b.name = text.trim().split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      state.flow = 'phone';
      return say(`Thanks ${b.name.split(' ')[0]}! Best mobile number for the confirmation text?`);
    }
    if (state.flow === 'phone') {
      const digits = text.replace(/\D/g, '');
      if (digits.length < 7) return say("That number looks short — could you double-check it?");
      b.phone = text.trim(); state.flow = 'address';
      return say('And the service address (street + area)?');
    }
    if (state.flow === 'address') {
      b.address = text.trim(); state.flow = null;
      const inArea = KB.areas.some(a => text.toLowerCase().includes(a));
      await say(`✅ You're booked!\n\n${b.reason}\n📅 ${b.slot}\n👤 ${b.name} · ${b.phone}\n📍 ${b.address}\n\nYou'll get a text confirmation now and a reminder the evening before. ${KB.fee}${inArea ? '' : "\n\n(I'll have the office double-check that address is inside our service area.)"}`, m => m.classList.add('msg--card'));
      await say("👆 That's the moment a missed call becomes a paid job. Want Harbor doing this for your business?");
      quick(['Yes — book my free audit', 'Ask another question']);
      window.hTrack?.('demo_booking_complete');
    }
  }

  /* ---------- Local intent engine ---------- */
  function local(q) {
    const s = q.toLowerCase();
    const price = KB.prices.find(p => p.k.test(s));
    const urgent = /burst|flood|emergenc|tonight|now|asap|urgent|gas|sewage|no water|leak(ing)?.*(bad|everywhere|ceiling)|water everywhere/.test(s);

    if (/^(hi|hey|hello|yo|hiya|good (morning|afternoon|evening))\b/.test(s))
      return { text: `Hi! 👋 I'm Harbor, ${KB.company}'s virtual assistant. I can quote prices, check our service area, or book a technician. What's going on?`, quick: ['Get a price', 'Book a visit', 'It\'s an emergency'] };
    if (/(are|r) (you|u) (a )?(bot|ai|robot|human|real)|talking to (a )?(bot|ai|human)/.test(s))
      return { text: "I'm an AI assistant — not a human — but I'm connected to the team's live calendar and can book real appointments. If you'd prefer a person, I can have the office call you back within 15 minutes." };
    if (/human|person|real person|manager|speak to|talk to someone|call me/.test(s))
      return { text: "Of course. I'll have the office call you back within 15 minutes during business hours (or the on-call tech right away for emergencies). Want me to set that up?", quick: ['Yes, call me back', 'No, keep chatting'] };
    if (/gas/.test(s) && /smell|leak/.test(s))
      return { text: "⚠️ If you smell gas: leave the building now, don't switch anything on or off, and call your gas utility's emergency line or 911 from outside. Once you're safe, I can get our tech out to repair the line." };
    if (urgent)
      return { text: `That sounds urgent — let's move fast. 🚨\n\n1) Turn off the water at the fixture's shut-off valve, or the main by your water meter.\n2) Move valuables away from the water.\n\nOur on-call tech can be dispatched tonight ($189 after-hours call-out), or I can grab the first slot tomorrow morning.`, quick: ['Dispatch tonight', 'First slot tomorrow'], book: price ? price.t + ' (urgent)' : 'Emergency repair' };
    if (/dispatch tonight|page/.test(s))
      return { text: "Done — I've paged the on-call technician. He'll call you within 10 minutes to confirm an ETA (usually 45–90 min). What's the best number to reach you?", flow: 'phone', booking: { reason: 'After-hours emergency', slot: 'Tonight · ASAP' } };
    if (price)
      return { text: `${price.t}: ${price.p}.\n${price.n}\n\nFinal price is always confirmed upfront by the technician before any work starts — no surprises. Want me to book it?`, quick: ['Yes, book it', 'Do you offer financing?'], book: price.t };
    if (/price|cost|how much|charge|rate|quote|estimate|fee/.test(s))
      return { text: `Happy to help with pricing! A few common ones:\n• Drain cleaning: $149–$249\n• Leak & pipe repair: $175–$520\n• Water heater repair: $189–$450\n• Toilet repair: $129–$289\n\n${KB.fee} What do you need done?` };
    if (/area|service|cover|come to|located|near|zip|postcode|city|town|do you (go|service|work)/.test(s)) {
      const hit = KB.areas.find(a => s.includes(a));
      if (hit) return { text: `Yes! ${hit.replace(/\b\w/g, c => c.toUpperCase())} is in our core service area — no travel fee. Want me to check the next available time?`, quick: ['Book a visit', 'Get a price'] };
      return { text: `We cover ${KB.areas.slice(0, -1).map(a => a.replace(/\b\w/g, c => c.toUpperCase())).join(', ')} and North Hills. Which area are you in?` };
    }
    if (/hour|open|close|weekend|sunday|saturday|holiday/.test(s)) return { text: KB.hours + ' Want me to book something?' , quick: ['Book a visit'] };
    if (/financ|payment|pay (over|monthly)|afford|credit/.test(s)) return { text: 'Yes — 0% financing for 12 months on jobs over $1,000 (subject to approval). We accept all cards, Apple Pay and checks.' };
    if (/warrant|guarantee/.test(s)) return { text: 'Every repair has a 1-year parts & labor warranty, and new water heaters carry up to 10 years from the manufacturer.' };
    if (/review|rating|trust|licen[cs]ed|insured/.test(s)) return { text: 'We\'re fully licensed and insured, background-checked techs, and every job has a 1-year warranty. Happy to text you a link to our Google reviews.' };
    if (/book|appointment|schedule|come out|visit|available|slot|tomorrow|yes,? book|first slot/.test(s)) return { startBooking: /remodel|bathroom|kitchen/.test(s) ? 'Remodel quote (free)' : (/first slot/.test(s) ? 'Emergency repair' : null) };
    if (/yes,? call me back/.test(s)) return { text: 'Great — what\'s the best number to reach you?', flow: 'phone', booking: { reason: 'Callback request', slot: 'Within 15 minutes' } };
    if (/thank|thx|cheers|awesome|great|perfect/.test(s)) return { text: "Anytime! Anything else I can help with?" };
    if (/book my free audit|for my business|harbor|how does this work|sign up/.test(s)) return { audit: true };
    if (/ask another|keep chatting|no,? /.test(s)) return { text: 'Sure — ask me anything about prices, emergencies, our service area or booking.' };
    return { text: "Good question — I want to get that exactly right, so I'll have a technician confirm. In the meantime I can quote common jobs, check your area, or book a visit. Which would help most?", quick: ['Get a price', 'Book a visit', 'Talk to a person'] };
  }

  async function viaApi(q) {
    if (state.api === false) return null;
    try {
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ messages: state.history.slice(-16) })
      });
      clearTimeout(to);
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      state.api = true;
      return j;
    } catch { state.api = false; return null; }
  }

  async function handle(raw) {
    const q = raw.trim(); if (!q) return;
    add(q, 'me'); state.history.push({ role: 'user', content: q });
    window.hTrack?.('demo_message');

    if (state.flow) return bookingStep(q);

    const r = local(q);
    if (r.startBooking === null && state.pendingBook) { r.startBooking = state.pendingBook; }
    state.pendingBook = r.book || null;
    if (r.audit) {
      await say("Love it. Scroll down — I'll take you to the free missed-call audit form. 👇");
      setTimeout(() => document.getElementById('book').scrollIntoView({ behavior: 'smooth' }), 900);
      return;
    }
    if (r.startBooking !== undefined) return startBooking(r.startBooking);

    // Prefer Claude for free-form questions when deployed; keep local for structured intents.
    const isFallback = r.text?.startsWith('Good question');
    if (isFallback) {
      const t = typing();
      const api = await viaApi(q);
      t.remove();
      if (api?.reply) {
        add(api.reply);
        if (api.action === 'book') return startBooking(api.reason);
        return;
      }
    }
    await say(r.text);
    if (r.flow) { state.flow = r.flow; state.booking = r.booking; }
    if (r.quick) quick(r.quick);
  }

  const greet = () => {
    log.innerHTML = ''; state.history = []; state.flow = null;
    say(`Hi! 👋 I'm Harbor, ${KB.company}'s virtual assistant. I can quote prices, handle emergencies, or book a technician in about 30 seconds. What's going on?`);
  };

  /* ---------- Voice mode: talk to Harbor in the browser (Web Speech API) ---------- */
  const mic = document.getElementById('botMic');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR && 'speechSynthesis' in window && mic) {
    mic.hidden = false;
    const rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.maxAlternatives = 1;
    let pickVoice;
    const choose = () => {
      const vs = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
      pickVoice = vs.find(v => /natural|neural|samantha|google us|aria|jenny/i.test(v.name)) || vs[0];
    };
    choose(); speechSynthesis.onvoiceschanged = choose;
    voice.on = false;
    // Always-on listening while voice mode is on, so the visitor can talk over Harbor (barge-in).
    rec.continuous = true;
    let listening = false, speakingText = '';
    const norm = t => t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    // Ignore the mic hearing Harbor's own voice from the speakers.
    const isEcho = t => {
      if (!speakingText) return false;
      const said = new Set(norm(speakingText)), words = norm(t);
      return words.length > 0 && words.filter(w => said.has(w)).length / words.length > 0.6;
    };
    const listen = () => {
      if (!voice.on || listening) return;
      try { rec.start(); listening = true; mic.classList.add('is-live'); input.placeholder = 'Listening… (talk any time, even over Harbor)'; } catch {}
    };
    voice.speak = text => {
      if (!voice.on) return;
      const clean = text.replace(/[\u{1F300}-\u{1FAFF}☀-➿✅📅👤📍👆]/gu, '').replace(/\$(\d+)–\$(\d+)/g, '$$$1 to $$$2');
      const u = new SpeechSynthesisUtterance(clean);
      if (pickVoice) u.voice = pickVoice;
      u.rate = 1.07;
      speakingText += ' ' + clean;
      mic.classList.add('is-speaking');
      u.onend = u.onerror = () => { if (!speechSynthesis.speaking && !speechSynthesis.pending) { speakingText = ''; mic.classList.remove('is-speaking'); } };
      speechSynthesis.speak(u);
      listen();
    };
    rec.onresult = e => {
      const r = e.results[e.results.length - 1];
      const t = r[0].transcript.trim();
      if (!t || isEcho(t)) return;
      if (speechSynthesis.speaking) {          // barge-in: stop talking the moment the visitor speaks
        speechSynthesis.cancel(); speakingText = ''; mic.classList.remove('is-speaking');
        window.hTrack?.('demo_voice_interrupt');
      }
      input.value = t;
      if (r.isFinal) { input.value = ''; handle(t); }
    };
    rec.onend = () => {
      listening = false;
      if (voice.on) return setTimeout(listen, 150);  // browsers stop recognition periodically; resume
      mic.classList.remove('is-live'); input.placeholder = 'Type, or tap the mic and talk…';
    };
    rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { stop(); add("I couldn't access your microphone — you can still type to me."); } };
    const stop = () => { voice.on = false; listening = false; speakingText = ''; mic.setAttribute('aria-pressed', 'false'); mic.classList.remove('is-live', 'is-speaking'); try { rec.abort(); } catch {} speechSynthesis.cancel(); input.placeholder = 'Type, or tap the mic and talk…'; };
    mic.addEventListener('click', () => {
      if (voice.on) return stop();
      voice.on = true; mic.setAttribute('aria-pressed', 'true');
      window.hTrack?.('demo_voice_start');
      const last = [...log.querySelectorAll('.msg--ai')].pop();
      if (last) voice.speak(last.textContent); else listen();
    });
  }

  form.addEventListener('submit', e => { e.preventDefault(); const v = input.value; input.value = ''; handle(v); });
  document.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => {
    document.getElementById('bot').scrollIntoView({ behavior: 'smooth', block: 'center' });
    handle(b.dataset.ask);
  }));
  document.getElementById('botReset').addEventListener('click', greet);

  // Greet when the demo scrolls into view
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { greet(); o.disconnect(); } }, { threshold: 0.3 }).observe(log);
})();
