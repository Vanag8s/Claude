/* Voice tone sensing in the browser.
   While the visitor talks to Harbor by voice, we measure HOW they speak (not what):
   speaking pace, loudness compared with their own baseline, pitch variation and pauses.
   Nothing is recorded or uploaded; only these few labels go along with the message. */
(() => {
  let ctx, analyser, stream, timer, buf;
  let frames = [];            // { t, db, f0 }
  let baselineDb = null;      // the visitor's normal loudness, learned over utterances
  const history = [];

  const rmsDb = data => {
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    return 20 * Math.log10(Math.sqrt(sum / data.length) + 1e-8);
  };

  // Simple autocorrelation pitch detector (70–400 Hz is the human speaking range).
  function pitch(data, sampleRate) {
    const minLag = Math.floor(sampleRate / 400), maxLag = Math.floor(sampleRate / 70);
    let best = 0, bestLag = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let c = 0;
      for (let i = 0; i < data.length - lag; i++) c += data[i] * data[i + lag];
      if (c > best) { best = c; bestLag = lag; }
    }
    let energy = 0; for (let i = 0; i < data.length; i++) energy += data[i] * data[i];
    return bestLag && best / (energy + 1e-8) > 0.35 ? sampleRate / bestLag : null;
  }

  async function start() {
    if (ctx) return true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } });
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
      src.connect(analyser);
      buf = new Float32Array(analyser.fftSize);
      timer = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        const db = rmsDb(buf);
        frames.push({ t: performance.now(), db, f0: db > -50 ? pitch(buf, ctx.sampleRate) : null });
        if (frames.length > 1200) frames.shift(); // ~60 s
      }, 50);
      return true;
    } catch { return false; }
  }

  function stop() {
    clearInterval(timer); timer = null;
    stream?.getTracks().forEach(t => t.stop());
    ctx?.close(); ctx = analyser = stream = null; frames = [];
  }

  /** Summarize the utterance that just ended (call with its transcript). */
  function take(transcript) {
    if (!frames.length) return null;
    const now = performance.now();
    const recent = frames.filter(f => now - f.t < 15000);
    frames = [];
    const voiced = recent.filter(f => f.db > -50);
    if (voiced.length < 6) return null;
    const words = (transcript || '').trim().split(/\s+/).filter(Boolean).length;
    const spanMs = voiced.at(-1).t - voiced[0].t + 50;
    const wpm = words / (spanMs / 60000);
    const avgDb = voiced.reduce((a, f) => a + f.db, 0) / voiced.length;
    const f0s = voiced.map(f => f.f0).filter(Boolean);
    let semis = null;
    if (f0s.length > 5) {
      const st = f0s.map(f => 12 * Math.log2(f / 100));
      const m = st.reduce((a, x) => a + x, 0) / st.length;
      semis = Math.sqrt(st.reduce((a, x) => a + (x - m) ** 2, 0) / st.length);
    }
    // Pauses: silent gaps longer than 400 ms inside the utterance
    let pauses = 0, gap = 0;
    recent.filter(f => f.t >= voiced[0].t && f.t <= voiced.at(-1).t).forEach(f => {
      if (f.db <= -50) gap += 50; else { if (gap >= 400) pauses++; gap = 0; }
    });

    const base = baselineDb ?? avgDb;
    baselineDb = baselineDb === null ? avgDb : baselineDb * 0.7 + avgDb * 0.3;
    const out = {
      wpm: Math.round(wpm),
      pace: wpm > 175 ? 'fast' : wpm < 105 ? 'slow' : 'normal',
      loudness: history.length && avgDb > base + 4 ? 'loud' : history.length && avgDb < base - 5 ? 'soft' : 'normal',
      pitch_variation: semis === null ? 'normal' : semis > 3.5 ? 'animated' : semis < 1.4 ? 'flat' : 'normal',
      pauses: pauses >= 3 ? 'many' : 'few',
    };
    history.push(out);
    return out;
  }

  window.harborTone = { start, stop, take, get active() { return !!ctx; } };
})();
