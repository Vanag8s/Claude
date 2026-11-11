/* Talk to Harbor.
   Two modes:
   • concierge (default): Harbor talks with the visitor (a business owner), senses their tone,
     and knows when to bring up the membership. Powered by /api/concierge (Claude); a small local
     engine keeps it working if the API isn't reachable.
   • receptionist: Harbor role-plays as the visitor's own receptionist (/api/chat with their profile),
     or as a sample plumbing company when offline.
   Voice: talk with the mic, interrupt Harbor mid-sentence; tone.js adds how you sound. */
(() => {
  const $ = id => document.getElementById(id);
  const log = $('botLog'), form = $('botForm'), input = $('botInput');
  if (!log) return;

  const PLANS = {
    shore: { name: 'Shore', price: 149, for: 'small & solo businesses' },
    tide: { name: 'Tide', price: 349, for: 'growing businesses' },
    ocean: { name: 'Ocean', price: 899, for: 'big teams & multiple locations' },
  };
  const SAMPLE = {
    company: 'Riverside Plumbing',
    areas: ['riverside', 'oakwood', 'maple heights', 'cedar park', 'lakeview', 'downtown', 'north hills'],
    prices: [
      { k: /drain|clog|unclog|backed? up/, t: 'Drain cleaning', p: '$149–$249' },
      { k: /water heater|hot water|boiler/, t: 'Water heater repair', p: '$189–$450, replacement from $1,450' },
      { k: /toilet/, t: 'Toilet repair', p: '$129–$289' },
      { k: /leak|pipe|burst/, t: 'Leak & pipe repair', p: '$175–$520' },
      { k: /faucet|tap|sink/, t: 'Faucet & sink repair', p: '$119–$259' },
    ],
    fee: 'The diagnostic visit is $89, waived if you go ahead with the repair.',
  };

  const state = { mode: 'concierge', history: [], flow: null, booking: {}, profile: null, sample: false, api: {}, turns: 0, last: null, business: {} };
  const voice = { on: false, speak: () => {}, lastFeatures: null };

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
    await new Promise(r => setTimeout(r, Math.min(400 + text.length * 8, 1400)));
    t.remove();
    const m = add(text);
    if (extra) extra(m);
    return m;
  };
  // Buttons: plain strings are sent as messages; {label, run, cta} objects run an action.
  const quick = opts => {
    const wrap = document.createElement('div'); wrap.className = 'quick';
    opts.forEach(o => {
      const b = document.createElement('button'); b.type = 'button';
      b.textContent = typeof o === 'string' ? o : o.label;
      if (o.cta) b.className = 'is-cta';
      b.onclick = () => { wrap.remove(); typeof o === 'string' ? handle(o) : o.run(); };
      wrap.append(b);
    });
    log.append(wrap); scroll();
  };
  const goTo = (id, focusId) => setTimeout(() => {
    $(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (focusId) setTimeout(() => $(focusId)?.focus({ preventScroll: true }), 700);
  }, 500);

  /* ---------- "What Harbor senses" panel ---------- */
  const senseEl = $('botSense'), senseToggle = $('showSense');
  const TONE_EMOJI = { calm: '😌', friendly: '🙂', curious: '🤔', excited: '🤩', skeptical: '🤨', rushed: '⏱️', frustrated: '😤', worried: '😟', confused: '😕', neutral: '😐' };
  const STAGE_LABEL = { exploring: 'just exploring', interested: 'interested', evaluating: 'weighing it up', objection: 'has a concern', ready_to_buy: 'ready to buy', not_a_fit: 'not a fit' };
  function renderSense() {
    const s = state.last;
    if (!senseEl) return;
    senseEl.hidden = !(senseToggle?.checked && s);
    if (!s) return;
    const chips = [
      `<span>${TONE_EMOJI[s.tone?.label] || '🙂'} Tone: <b>${s.tone?.label || '?'}</b>${s.tone?.intensity ? ` (${s.tone.intensity})` : ''}</span>`,
      `<span>🧭 Stage: <b>${STAGE_LABEL[s.stage] || s.stage}</b></span>`,
      `<span>💡 Right moment to sell: <b>${s.sell_now ? 'yes' : 'not yet'}</b></span>`,
      s.plan && s.plan !== 'none' ? `<span>🌊 Best fit: <b>${PLANS[s.plan]?.name}</b></span>` : '',
      s.tone?.cues ? `<span>👂 ${escapeHtml(s.tone.cues)}</span>` : '',
      s.voice ? `<span>🎙 You sounded: <b>${[s.voice.pace !== 'normal' && s.voice.pace, s.voice.loudness !== 'normal' && s.voice.loudness, s.voice.pitch_variation !== 'normal' && s.voice.pitch_variation].filter(Boolean).join(', ') || 'relaxed'}</b></span>` : '',
    ];
    senseEl.innerHTML = chips.filter(Boolean).join('');
  }
  const escapeHtml = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  senseToggle?.addEventListener('change', () => { renderSense(); window.hTrack?.('sense_toggle', { on: senseToggle.checked }); });

  /* ---------- Concierge actions ---------- */
  function highlightPlan(plan) {
    document.querySelectorAll('[data-plan-card]').forEach(c => c.classList.toggle('is-recommended', c.dataset.planCard === plan));
    const sel = $('planSelect'); if (sel && PLANS[plan]) sel.value = plan;
  }
  function prefill() {
    const b = state.business;
    if (b.name && $('company') && !$('company').value) $('company').value = b.name;
  }
  const startMembership = plan => {
    if (PLANS[plan]) highlightPlan(plan);
    prefill(); window.hTrack?.('concierge_to_signup', { plan });
    goTo('join', 'name');
  };
  async function runAction(r) {
    const plan = PLANS[r.plan] ? r.plan : null;
    if (plan) highlightPlan(plan);
    switch (r.action) {
      case 'show_plans':
        return quick([
          { label: `Shore · $149`, run: () => handle('Tell me about Shore') },
          { label: `Tide · $349`, run: () => handle('Tell me about Tide') },
          { label: `Ocean · $899`, run: () => handle('Tell me about Ocean') },
          { label: 'Compare all', run: () => goTo('membership') },
        ]);
      case 'recommend_plan':
        return quick([
          { label: `Start ${PLANS[plan || 'tide'].name} membership`, cta: true, run: () => startMembership(plan || 'tide') },
          { label: '🎭 Hear it as my receptionist', run: () => handle('Can you act as my receptionist so I can hear it?') },
        ]);
      case 'start_membership':
        prefill();
        quick([{ label: `Open the sign-up form${plan ? ` (${PLANS[plan].name})` : ''}`, cta: true, run: () => startMembership(plan) }]);
        return;
      case 'offer_call_demo':
        return quick([{ label: '📞 Have Harbor call my phone', cta: true, run: () => goTo('callMe', 'callPhone') }]);
      case 'start_roleplay':
        return startRoleplay(r.business, r.roleplay_greeting);
    }
  }

  function startRoleplay(biz = {}, greeting = '') {
    const name = biz.name || state.business.name || '';
    if (state.api.concierge === true && (name || greeting)) {
      state.profile = state.profile || { company: name || 'your business', trade: biz.type || state.business.type || 'business', services: [], service_area: [], faq: [], greeting };
      if (greeting) state.profile.greeting = greeting;
    } else { state.sample = true; }
    state.mode = 'receptionist'; state.flow = null;
    const company = state.profile?.company || SAMPLE.company;
    $('botName').textContent = company;
    $('botSub').innerHTML = '<span class="dot"></span> 🎭 Harbor playing your receptionist · tap ↺ to come back';
    const note = document.createElement('div'); note.className = 'msg msg--card';
    note.textContent = state.sample
      ? `🎭 Okay! I'll play the receptionist for a sample plumbing company, ${SAMPLE.company}. Talk to me like a customer: ask a price, have an emergency, book a visit.`
      : `🎭 Now I'm ${company}'s receptionist. Call me like a customer would: ask a question, book something, or be a difficult caller.`;
    log.append(note); scroll();
    setTimeout(() => say(state.profile?.greeting || `Thanks for calling ${company}, this is Harbor, the virtual assistant. How can I help?`), 700);
    window.hTrack?.('roleplay_start');
  }

  /* ---------- Local concierge (works without the API) ---------- */
  function senseLocally(q, v) {
    const s = q.toLowerCase();
    const bangs = (q.match(/!/g) || []).length, caps = (q.match(/\b[A-Z]{3,}\b/g) || []).length;
    let label = 'friendly', cues = '';
    if (/(annoy|frustrat|ridiculous|waste|sick of|fed up|hate|angry|wtf|damn|useless)/.test(s) || caps >= 2) { label = 'frustrated'; cues = 'strong words'; }
    else if (/(don'?t trust|scam|robot|doubt|skeptic|not sure|really\?|prove|sounds fake|gimmick)/.test(s)) { label = 'skeptical'; cues = 'doubting words'; }
    else if (/(quick|hurry|busy|no time|short version|tl;?dr|asap|fast)/.test(s)) { label = 'rushed'; cues = 'asked to keep it quick'; }
    else if (/(worried|afraid|scared|risk|what if|concern|nervous)/.test(s)) { label = 'worried'; cues = 'worry words'; }
    else if (/(confus|don'?t understand|what do you mean|huh|lost me)/.test(s) || /\?\?/.test(q)) { label = 'confused'; cues = 'unclear what we meant'; }
    else if (/(love|amazing|awesome|wow|perfect|exactly|great|nice)/.test(s) || bangs >= 2) { label = 'excited'; cues = 'positive, energetic words'; }
    else if (/^(how|what|can|does|why|is|do)\b/.test(s) || s.includes('?')) { label = 'curious'; cues = 'asking questions'; }
    if (v) {
      if (v.pace === 'fast' && ['friendly', 'curious'].includes(label)) { label = 'rushed'; cues = 'speaking fast'; }
      if (v.loudness === 'loud' && v.pitch_variation === 'animated' && label === 'friendly') { label = 'excited'; cues = 'lively, loud voice'; }
      if (v.pitch_variation === 'flat' && v.pace === 'slow' && label === 'friendly') { label = 'calm'; cues = 'slow, even voice'; }
    }
    const intensity = bangs >= 2 || caps >= 2 || v?.loudness === 'loud' ? 'high' : label === 'friendly' ? 'low' : 'medium';
    return { label, intensity, cues };
  }
  function sizeFrom(s) {
    if (/(solo|just me|one[- ]person|myself|freelanc|sole trader)/.test(s)) return 'solo';
    if (/(locations|franchise|branches|offices|chain|enterprise|hundreds|large team|\b[5-9]\d+ (staff|people|employees))/.test(s)) return 'large';
    if (/(team|staff|employees|people|trucks|chairs|\b([2-9]|1\d) (staff|people|employees|techs|stylists|dentists))/.test(s)) return 'growing';
    if (/(small|tiny|little)/.test(s)) return 'small';
    return null;
  }
  const planFor = size => (size === 'large' ? 'ocean' : size === 'growing' ? 'tide' : size ? 'shore' : 'tide');
  function localConcierge(q, v) {
    const s = q.toLowerCase();
    const tone = senseLocally(q, v);
    const b = state.business;
    b.size = sizeFrom(s) || b.size || 'unknown';
    const type = s.match(/\b(dental|dentist|clinic|salon|barber|spa|plumb\w*|hvac|electric\w*|roof\w*|law|legal|real estate|realtor|restaurant|cafe|auto|garage|mechanic|physio|vet|agency|gym)\b/);
    if (type) b.type = type[1];
    const pain = /(miss|missed|can'?t (answer|pick up)|voicemail|lose (customers|calls|clients)|too busy to answer|after hours)/.test(s);
    if (pain) b.pain = q.slice(0, 80);
    const plan = planFor(b.size);
    const r = { tone, stage: 'exploring', sell_now: false, action: 'none', plan: 'none', business: { ...b }, roleplay_greeting: '' };
    const turn = state.turns;

    if (/(act|pretend|be|play|sound like)( as)? (my|our) receptionist|hear it as|role.?play|demo (it|for me)/.test(s)) {
      r.stage = 'evaluating'; r.action = 'start_roleplay';
      r.reply = b.type ? `Love that. I'll answer as your ${b.type} receptionist. Pretend you're calling in.` : "Sure! I'll play a sample business's receptionist so you can hear it. Pretend you're a customer calling in.";
      return r;
    }
    if (/(sign me up|sign up|get started|start (my )?membership|join|let'?s do it|i'?m in|buy|subscribe)/.test(s)) {
      r.stage = 'ready_to_buy'; r.sell_now = true; r.action = 'start_membership'; r.plan = plan;
      r.reply = `Wonderful, welcome aboard! I'd start you on ${PLANS[plan].name} at $${PLANS[plan].price} a month. If it doesn't catch 30 calls you'd have missed in your first 30 days, the month's free. The sign-up takes a minute.`;
      return r;
    }
    const askedAbout = s.match(/tell me about (shore|tide|ocean)/);
    if (askedAbout) {
      const p = PLANS[askedAbout[1]]; r.stage = 'evaluating'; r.sell_now = true; r.action = 'recommend_plan'; r.plan = askedAbout[1];
      r.reply = `${p.name} is $${p.price} a month, made for ${p.for}. No contract, set up for you in 48 hours, and the first month's free if it doesn't pay off.`;
      return r;
    }
    if (/(price|cost|how much|pricing|expensive|cheap|afford|per month|plans?\b)/.test(s)) {
      r.stage = 'evaluating'; r.sell_now = true; r.plan = b.size !== 'unknown' ? plan : 'none';
      r.action = r.plan !== 'none' ? 'recommend_plan' : 'show_plans';
      r.reply = tone.label === 'rushed'
        ? `From $149 a month. ${r.plan !== 'none' ? `For you, ${PLANS[plan].name} at $${PLANS[plan].price}.` : 'Three sizes, no contract.'}`
        : `It's a monthly membership with no contract: Shore $149 for small businesses, Tide $349 for growing ones, and Ocean $899 for big teams.${r.plan !== 'none' ? ` From what you've told me, ${PLANS[plan].name} fits best.` : ' How many people answer your phones today?'}`;
      return r;
    }
    if (tone.label === 'skeptical' || /(robot|sound(s)? (real|human|natural)|ai on the phone)/.test(s)) {
      r.stage = 'objection'; r.action = 'offer_call_demo';
      r.reply = "That's a fair worry, and a lot of AI does sound robotic. The best proof is to hear me: I can call your phone right now, or play your receptionist here. You can interrupt me like a person.";
      quickLater(['🎭 Play my receptionist']);
      return r;
    }
    if (tone.label === 'frustrated') {
      r.stage = 'objection';
      r.reply = "I hear you. Missing calls when you're flat out is genuinely stressful. What's the part that bothers you most: lost customers, or the voicemails piling up?";
      return r;
    }
    if (tone.label === 'confused') {
      r.reply = "Sorry, let me make it simple: when you can't pick up, your calls go to me. I answer like a friendly receptionist, book the appointment, and text you what happened. That's it.";
      return r;
    }
    if (pain) {
      r.stage = 'interested'; r.business = { ...b };
      if (turn >= 1) { r.sell_now = true; r.action = 'recommend_plan'; r.plan = plan; }
      r.reply = r.sell_now
        ? `That's exactly what I'm for. Every one of those calls would get answered, booked and texted to you. For a ${b.type || 'business'} your size I'd suggest ${PLANS[plan].name}, and if I don't catch 30 calls you'd have missed in 30 days, the first month's free.`
        : `That's exactly what I'm for: every one of those calls would get answered and booked, and you'd get a text with the details. Roughly how many calls a week do you think slip through?`;
      return r;
    }
    if (/^(hi|hey|hello|yo|hiya|good (morning|afternoon|evening))\b/.test(s)) {
      r.reply = "Hi! I'm Harbor. I answer the calls you can't, so customers never hit voicemail. What kind of business do you run?";
      return r;
    }
    if (type || b.size !== 'unknown') {
      r.stage = 'interested';
      r.reply = `Nice. ${b.type ? `For a ${b.type}, ` : ''}what usually happens when the phone rings and nobody can get to it?`;
      return r;
    }
    if (/(how does|how do(es)? it work|setup|set up|forward|number)/.test(s)) {
      r.stage = 'interested';
      r.reply = "We build your Harbor from your website and a short chat, you forward your calls when you're busy or after hours, and I take it from there. Most businesses are live in 48 hours. Want to hear me answer as your receptionist?";
      return r;
    }
    if (/(thank|thanks|cool|ok(ay)?|got it)/.test(s)) {
      r.reply = "Anytime! Would it help to hear me answer as your receptionist, or have me call your phone?";
      r.action = 'offer_call_demo';
      return r;
    }
    r.reply = "Good question. I'll make sure the team follows up on that exactly. Meanwhile, what kind of business are you running?";
    return r;
  }
  let pendingQuick = null;
  const quickLater = opts => (pendingQuick = opts);

  async function concierge(q, meta = {}) {
    let r = null;
    if (state.api.concierge !== false) {
      try {
        const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 20000);
        const res = await fetch('/api/concierge', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
          body: JSON.stringify({ messages: state.history.slice(-20), voice: meta.voice || null, via: meta.via || 'text' }),
        });
        clearTimeout(to);
        if (res.ok) { r = await res.json(); state.api.concierge = true; }
        else if (res.status === 404) state.api.concierge = false;
      } catch { /* network/timeout: fall back for this turn */ }
    }
    if (!r?.reply) r = localConcierge(q, meta.voice);
    return r;
  }

  /* ---------- Receptionist role-play ---------- */
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
  async function startBooking(reason) {
    state.flow = 'slot'; state.booking = { reason: reason || 'Appointment' };
    await say("Happy to get that booked. Here are the next open times. Tap one that works:", m => {
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
    if (state.flow === 'slot') { b.slot = text; state.flow = 'name'; return say(`${text}, perfect. What name should I put it under?`); }
    if (state.flow === 'name') {
      if (text.trim().length < 2) return say('Sorry, could you tell me your name?');
      b.name = text.trim().split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      state.flow = 'phone'; return say(`Thanks ${b.name.split(' ')[0]}! What's the best mobile number for the confirmation text?`);
    }
    if (state.flow === 'phone') {
      if (text.replace(/\D/g, '').length < 7) return say("That number looks a little short. Could you double-check it?");
      b.phone = text.trim(); state.flow = state.sample ? 'address' : null;
      if (state.sample) return say('And the address for the visit?');
    }
    if (state.flow === 'address') { b.address = text.trim(); state.flow = null; }
    state.flow = null;
    await say(`✅ You're booked!\n\n${b.reason}\n📅 ${b.slot}\n👤 ${b.name} · ${b.phone}${b.address ? `\n📍 ${b.address}` : ''}\n\nYou'll get a confirmation text now and a reminder the day before.${state.sample ? ' ' + SAMPLE.fee : ''}`, m => m.classList.add('msg--card'));
    window.hTrack?.('demo_booking_complete');
    const note = document.createElement('div'); note.className = 'msg msg--card';
    note.textContent = "🌊 That's a missed call turned into a booking, with no one picking up the phone. Want this answering your calls?";
    log.append(note); scroll();
    quick([{ label: 'Yes, start my membership', cta: true, run: () => backToConcierge('I just tried the receptionist demo and I loved it. I want to sign up.') }, { label: 'Keep testing', run: () => say('Go for it! Try being a tricky caller.') }]);
  }
  function sampleReceptionist(q) {
    const s = q.toLowerCase();
    const price = SAMPLE.prices.find(p => p.k.test(s));
    if (/gas/.test(s) && /smell|leak/.test(s)) return { text: "If you smell gas, please leave the building now and call the gas company or 911 from outside. Once you're safe, I'll get a technician out to you." };
    if (/burst|flood|emergenc|tonight|asap|urgent|water everywhere/.test(s)) return { text: "That sounds urgent, so let's move fast. First, turn off the water at the main valve, usually by your water meter. I can send our on-call plumber tonight for a $189 call-out, or get you the first slot tomorrow.", quick: ['Send someone tonight', 'First slot tomorrow'], book: 'Emergency repair' };
    if (price) return { text: `${price.t} is usually ${price.p}. The technician confirms the exact price before starting, so there are no surprises. Want me to book it?`, quick: ['Yes, book it'], book: price.t };
    if (/price|cost|how much/.test(s)) return { text: `Drain cleaning is $149 to $249, leak repairs $175 to $520, and water heater repairs $189 to $450. ${SAMPLE.fee} What do you need done?` };
    if (/(are|r) (you|u) (a )?(bot|ai|robot|human|real)/.test(s)) return { text: "I'm an AI assistant, not a person, but I'm connected to the team's real calendar. If you'd rather speak to someone, I can have them call you right back." };
    if (/area|cover|come to|near/.test(s)) return { text: 'We cover Riverside, Oakwood, Maple Heights, Cedar Park, Lakeview, Downtown and North Hills. Which area are you in?' };
    if (/book|appointment|schedule|visit|tonight|tomorrow|yes/.test(s)) return { startBooking: true };
    return { text: "Good question. I'll make sure a technician gets back to you on that. Is there something I can book for you in the meantime?" };
  }
  async function receptionist(q) {
    if (/^(back|stop|exit|end (the )?(demo|role.?play)|that'?s enough)/i.test(q)) return backToConcierge();
    if (state.profile) {
      if (/^(yes,? )?book|book (a|it|me)|appointment|schedule/i.test(q)) return startBooking(null);
      const t = typing();
      let r = null;
      try {
        const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: state.history.slice(-16), profile: state.profile }) });
        if (res.ok) r = await res.json();
      } catch {}
      t.remove();
      if (r?.reply) { add(r.reply); if (r.action === 'book') return startBooking(r.reason); return; }
      state.sample = true; // API unreachable: continue with the sample business
    }
    const r = sampleReceptionist(q);
    if (r.startBooking && state.pendingBook) return startBooking(state.pendingBook);
    if (r.startBooking) return startBooking('Service visit');
    state.pendingBook = r.book || state.pendingBook;
    await say(r.text);
    if (r.quick) quick(r.quick);
  }
  function backToConcierge(message) {
    state.mode = 'concierge'; state.flow = null; state.sample = false;
    $('botName').textContent = 'Harbor';
    $('botSub').innerHTML = '<span class="dot"></span> AI receptionist · usually replies in a second';
    const note = document.createElement('div'); note.className = 'msg msg--card';
    note.textContent = "🌊 Back to me, Harbor. How did that feel?";
    log.append(note); scroll();
    if (message) handle(message);
  }

  /* ---------- Main loop ---------- */
  async function handle(raw, meta = {}) {
    const q = String(raw || '').trim(); if (!q) return;
    add(q, 'me'); state.history.push({ role: 'user', content: q });
    window.hTrack?.('demo_message', { mode: state.mode, via: meta.via || 'text' });
    if (state.flow) return bookingStep(q);
    if (state.mode === 'receptionist') return receptionist(q);

    const t = typing();
    const r = await concierge(q, meta);
    t.remove();
    state.turns++;
    state.last = { ...r, voice: meta.voice || null };
    if (r.business) for (const k of ['name', 'type', 'size', 'pain']) if (r.business[k] && r.business[k] !== 'unknown') state.business[k] = r.business[k];
    renderSense();
    add(r.reply);
    if (r.sell_now) window.hTrack?.('concierge_sell_moment', { stage: r.stage, plan: r.plan });
    await runAction(r);
    if (pendingQuick) { const p = pendingQuick; pendingQuick = null; quick(p); }
  }

  window.harborBot = {
    useProfile(p) {
      state.profile = p; state.sample = false; state.business.name = p.company;
      state.mode = 'receptionist'; state.flow = null;
      $('botName').textContent = p.company || 'Your business';
      $('botSub').innerHTML = '<span class="dot"></span> 🎭 Harbor playing your receptionist · tap ↺ to come back';
      $('bot').scrollIntoView({ behavior: 'smooth', block: 'center' });
      say(p.greeting || `Hi! Thanks for calling ${p.company}, this is Harbor, the virtual assistant. How can I help?`);
      input.focus({ preventScroll: true });
    },
    handle,
  };

  const greet = () => {
    log.innerHTML = ''; state.history = []; state.flow = null; state.turns = 0; state.last = null;
    state.mode = 'concierge'; state.sample = false;
    $('botName').textContent = 'Harbor';
    $('botSub').innerHTML = '<span class="dot"></span> AI receptionist · usually replies in a second';
    renderSense();
    say("Hi, I'm Harbor 👋 I answer the calls your business can't, in a voice your customers will actually like. What kind of business do you run?");
  };

  /* ---------- Voice: talk to Harbor, interrupt it, and let it hear your tone ---------- */
  const mic = $('botMic');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR && 'speechSynthesis' in window && mic) {
    mic.hidden = false;
    const rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = true;
    let pickVoice;
    const choose = () => {
      const vs = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
      pickVoice = vs.find(v => /natural|neural|samantha|google us|aria|jenny|ava|serena/i.test(v.name)) || vs[0];
    };
    choose(); speechSynthesis.onvoiceschanged = choose;
    let listening = false, speakingText = '';
    const norm = t => t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    const isEcho = t => {   // ignore the mic hearing Harbor's own voice
      if (!speakingText) return false;
      const said = new Set(norm(speakingText)), words = norm(t);
      return words.length > 0 && words.filter(w => said.has(w)).length / words.length > 0.6;
    };
    const listen = () => {
      if (!voice.on || listening) return;
      try { rec.start(); listening = true; mic.classList.add('is-live'); input.placeholder = 'Listening… talk any time, even over Harbor'; } catch {}
    };
    voice.speak = text => {
      if (!voice.on) return;
      const clean = text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '').replace(/\$(\d+)–\$(\d+)/g, '$$$1 to $$$2');
      const u = new SpeechSynthesisUtterance(clean);
      if (pickVoice) u.voice = pickVoice;
      // Mirror the visitor: a touch quicker if they're rushed, gentler if they're worried.
      const tone = state.last?.tone?.label;
      u.rate = tone === 'rushed' ? 1.15 : tone === 'worried' || tone === 'frustrated' ? 0.97 : 1.05;
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
      if (speechSynthesis.speaking) {   // barge-in: stop talking the moment the visitor speaks
        speechSynthesis.cancel(); speakingText = ''; mic.classList.remove('is-speaking');
        window.hTrack?.('demo_voice_interrupt');
      }
      input.value = t;
      if (r.isFinal) { input.value = ''; handle(t, { via: 'voice', voice: window.harborTone?.take(t) || null }); }
    };
    rec.onend = () => {
      listening = false;
      if (voice.on) return setTimeout(listen, 150);
      mic.classList.remove('is-live'); input.placeholder = 'Type, or tap the mic and talk…';
    };
    rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { stop(); add("I couldn't get to your microphone, but you can still type to me."); } };
    const stop = () => {
      voice.on = false; listening = false; speakingText = '';
      mic.setAttribute('aria-pressed', 'false'); mic.classList.remove('is-live', 'is-speaking');
      try { rec.abort(); } catch {}
      speechSynthesis.cancel(); window.harborTone?.stop();
      input.placeholder = 'Type, or tap the mic and talk…';
    };
    mic.addEventListener('click', async () => {
      if (voice.on) return stop();
      voice.on = true; mic.setAttribute('aria-pressed', 'true');
      window.hTrack?.('demo_voice_start');
      window.harborTone?.start();   // tone sensing (pace, loudness, pitch); nothing is recorded
      const last = [...log.querySelectorAll('.msg--ai')].pop();
      if (last) voice.speak(last.textContent); else listen();
    });
  }

  form.addEventListener('submit', e => { e.preventDefault(); const v = input.value; input.value = ''; handle(v); });
  document.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => {
    $('bot').scrollIntoView({ behavior: 'smooth', block: 'center' });
    handle(b.dataset.ask);
  }));
  $('botReset').addEventListener('click', () => { state.profile = null; state.business = {}; greet(); });

  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { greet(); o.disconnect(); } }, { threshold: 0.3 }).observe(log);
})();
