/* Offline answering for the test chat (used only when the Claude API isn't reachable).
   It searches the owner's own facts and answers with the best-matching ones. Never invents. */
(() => {
  const STOP = new Set('a an the is are do does can i you we my our your to of for in on at and or it be with about what when how much there this that me us kids'.split(' '));
  const SYN = {
    open: ['open', 'opens', 'opening', 'hours', 'close', 'closes', 'closing', 'time', 'today', 'weekend', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    price: ['price', 'prices', 'cost', 'costs', 'how much', 'ticket', 'tickets', 'fee', 'pay', 'cheap', 'expensive', '$', '€', 'eur', 'usd'],
    child: ['kid', 'kids', 'child', 'children', 'son', 'daughter', 'teen', 'teenager', 'age', 'ages', 'old', 'year', 'years', 'minor', 'adult', 'parent', 'parents', 'alone', 'without', 'accompanied', 'student'],
    where: ['where', 'address', 'location', 'located', 'parking', 'park', 'directions', 'find'],
    contact: ['email', 'phone', 'call', 'contact', 'number'],
    book: ['book', 'booking', 'reserve', 'reservation', 'appointment', 'schedule', 'party', 'birthday'],
    buy: ['buy', 'purchase', 'order', 'get', 'want', "i'll take", 'sign up', 'deal'],
  };
  const stem = w => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
  const words = t => (t.toLowerCase().match(/[a-z0-9$€]+/g) || []).filter(w => !STOP.has(w)).map(stem);
  const topicsOf = q => Object.entries(SYN).filter(([, ws]) => ws.some(w => q.includes(w))).map(([k]) => k);

  function facts(p) {
    const f = [];
    if (p.hours) f.push({ t: `We're open ${p.hours.replace(/^open\s*/i, '')}`, topic: 'open' });
    if (p.location) f.push({ t: `You'll find us at ${p.location}`, topic: 'where' });
    if (p.contact) f.push({ t: `You can reach the team at ${p.contact}`, topic: 'contact' });
    (p.offerings || []).forEach(o => f.push({ t: `${o.name}${o.price ? `: ${o.price}` : ''}${o.details ? ` (${o.details})` : ''}`, topic: 'price', offer: o }));
    (p.rules || '').split(/(?<=[.!?])\s+/).filter(Boolean).forEach(s => f.push({ t: s.trim(), topic: 'rule' }));
    (p.faq || []).forEach(x => f.push({ t: x.a, q: x.q, topic: 'faq' }));
    (p.about || '').split(/(?<=[.!?])\s+/).filter(Boolean).forEach(s => f.push({ t: s.trim(), topic: 'about' }));
    return f;
  }

  function score(q, fact, topics) {
    const qw = new Set(words(q));
    const fw = words(fact.t + ' ' + (fact.q || ''));
    let s = fw.reduce((a, w) => a + (qw.has(w) ? 2 : 0), 0);
    const nums = (q.match(/\d+/g) || []);
    if (nums.some(n => new RegExp(`\\b${n}\\b`).test(fact.t))) s += 3;
    if (topics.includes('open') && fact.topic === 'open') s += 6;
    if (topics.includes('where') && fact.topic === 'where') s += 6;
    if (topics.includes('contact') && fact.topic === 'contact') s += 4;
    if (topics.includes('price') && fact.topic === 'price') s += 4;
    if (topics.includes('child') && /(child|kid|age|adult|under|years?|old|accompan|student|minor|\d+\s*[–-]\s*\d+)/i.test(fact.t)) s += 5;
    if (fact.topic === 'faq' && fact.q) s += words(fact.q).filter(w => qw.has(w)).length * 2;
    return s;
  }

  /** Returns { text, action? } */
  function answer(p, q, ctx = {}) {
    const s = q.toLowerCase();
    const topics = topicsOf(s);
    const company = p.company || 'us';
    if (/^(hi|hey|hello|labas|sveiki|good (morning|afternoon|evening))\b/.test(s)) return { text: `Hi! Thanks for contacting ${company}. How can I help?` };
    if (/(are|r) (you|u) (a )?(bot|ai|robot|human|real|person)/.test(s)) return { text: `I'm ${company}'s AI assistant, not a person. I can answer questions, and if you'd like, I can get someone from the team to call you back.` };
    if (/(human|real person|manager|speak to someone|talk to someone)/.test(s)) return { text: `Of course. I'll ask the team to call you back as soon as possible. What's your name and number?`, action: { type: 'take_message', details: { message: 'Caller asked for a person' } } };

    const fs = facts(p).map(f => ({ ...f, s: score(s, f, topics) })).sort((a, b) => b.s - a.s);
    const best = fs.filter(f => f.s >= 4).slice(0, topics.includes('price') && !/\b(this|that|it)\b/.test(s) ? 3 : 2);

    // Buying signal in sales mode
    if (p.mode === 'sales' && topics.includes('buy') && /(buy|take|order|purchase|sign me up|i want|i'll)/.test(s)) {
      const o = fs.find(f => f.offer && f.s >= 2)?.offer || (p.offerings || [])[0];
      return { text: `Great choice${o ? `, the ${o.name}${o.price ? ` is ${o.price}` : ''}` : ''}! What name should I put it under, and the best phone or email to confirm?`, action: { type: 'capture_sale', details: { product: o?.name || 'not specified' } } };
    }
    if (topics.includes('book') && /(book|reserve|appointment|schedule|can i (come|get))/.test(s) && !best.length) {
      return { text: `Happy to help you book. What day and time would suit you, and what's your name?`, action: { type: 'book', details: { what: q } } };
    }
    if (!best.length) {
      return { text: `Good question. I don't have that information, so I don't want to guess. I can pass it to the team and they'll get back to you. Would that help?` };
    }

    let text = best.map(f => f.t.replace(/\s+$/, '')).join('. ').replace(/\.\./g, '.');
    if (!/[.!?]$/.test(text)) text += '.';
    // Friendly framing for age/safety questions
    if (topics.includes('child') && best.some(f => f.topic === 'rule')) text = `Good question. Here's our rule: ${text}`;
    // Gentle upsell in sales mode
    if (p.mode === 'sales' && topics.includes('price') && p.sales?.upsells && !ctx.upsold) {
      text += ` By the way: ${p.sales.upsells.split(/;|\n/)[0].trim()}.`;
      ctx.upsold = true;
    }
    if (p.mode === 'sales' && /(expensive|too much|cheaper|discount|not worth)/.test(s) && p.sales?.objections) {
      text = `I understand. ${p.sales.objections.split(/\n|(?<=\.)\s/)[0].replace(/^[^:]*:\s*/, '')} ${p.sales.offers ? 'Also, ' + p.sales.offers.charAt(0).toLowerCase() + p.sales.offers.slice(1) + '.' : ''}`.trim();
    }
    return { text };
  }

  window.harborKB = { answer };
})();
