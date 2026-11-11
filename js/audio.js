/* WebAudio の効果音と BGM（音声ファイル不要） */
(function () {
  'use strict';
  let ctx = null, master = null, sfxBus = null, musicBus = null, reverbIn = null, delayIn = null;
  let muted = false, musicOn = true;

  function makeImpulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 3;
      master.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
      // 残響（鏡の空間っぽく）
      const rev = ctx.createConvolver(); rev.buffer = makeImpulse(3.2, 2.6);
      const revOut = ctx.createGain(); revOut.gain.value = 0.55;
      reverbIn = ctx.createGain(); reverbIn.connect(rev); rev.connect(revOut); revOut.connect(master);
      // ディレイ（付点8分）
      delayIn = ctx.createGain();
      const dl = ctx.createDelay(1.5); dl.delayTime.value = 60 / BPM * 0.75;
      const fb = ctx.createGain(); fb.gain.value = 0.38;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      delayIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl);
      const dOut = ctx.createGain(); dOut.gain.value = 0.45;
      lp.connect(dOut); dOut.connect(musicBus); dOut.connect(reverbIn);
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (!scheduler) startScheduler();
    return ctx;
  }

  // ---------- 効果音 ----------
  function tone(freq, dur, type, vol, freqEnd, delay, opts) {
    if (muted || !ensure()) return;
    opts = opts || {};
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + (opts.attack || 0.008));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (opts.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; o.connect(f); node = f; }
    node.connect(gn); gn.connect(sfxBus);
    if (opts.rev) { const s = ctx.createGain(); s.gain.value = opts.rev; gn.connect(s); s.connect(reverbIn); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, freq, delay, type) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 1000; f.Q.value = 1.2;
    const gn = ctx.createGain(); gn.gain.value = vol;
    src.connect(f); f.connect(gn); gn.connect(sfxBus);
    src.start(t);
  }

  // ベルのような澄んだ音（倍音を少し重ねたサイン波）
  function bell(freq, delay, vol, dur) {
    dur = dur || 1.6;
    tone(freq, dur, 'sine', vol, null, delay, { attack: 0.005, rev: 0.6 });
    tone(freq * 2, dur * 0.6, 'sine', vol * 0.25, null, delay, { attack: 0.005, rev: 0.6 });
    tone(freq * 3, dur * 0.3, 'sine', vol * 0.08, null, delay, { attack: 0.005, rev: 0.6 });
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- BGM（サイバー空間風・自動生成） ----------
  const BPM = 104;
  const SIXTEENTH = 60 / BPM / 4;
  const CHORDS = [
    { root: 45, tones: [57, 60, 64, 67, 71] }, // Am9
    { root: 41, tones: [53, 57, 60, 64, 69] }, // Fmaj7
    { root: 48, tones: [55, 59, 60, 64, 67] }, // Cmaj7
    { root: 40, tones: [52, 55, 59, 62, 66] }, // Em7(9)
  ];
  const ARP = [0, 2, 4, 2, 1, 3, 4, 3, 0, 2, 4, 5, 3, 2, 1, 2];
  let mode = 'off';       // off | calm | title | play
  let scheduler = null, step = 0, nextTime = 0;

  function vnode(type, freq, t, dur, vol, out, opts) {
    opts = opts || {};
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    if (opts.detune) o.detune.value = opts.detune;
    const g = ctx.createGain();
    const a = opts.attack || 0.005, r = opts.release || dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    if (opts.sustain) g.gain.setValueAtTime(vol, t + Math.max(a, dur - r));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = o;
    if (opts.lp) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; f.Q.value = opts.q || 0.7;
      if (opts.sweep) { f.frequency.setValueAtTime(opts.lp, t); f.frequency.exponentialRampToValueAtTime(opts.sweep, t + dur); }
      o.connect(f); n = f;
    }
    n.connect(g);
    for (const dst of out) { if (Array.isArray(dst)) { const s = ctx.createGain(); s.gain.value = dst[1]; g.connect(s); s.connect(dst[0]); } else g.connect(dst); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  function scheduleStep(s, t) {
    const bar = Math.floor(s / 16), pos = s % 16;
    const ch = CHORDS[Math.floor(bar / 2) % CHORDS.length];
    const barLen = SIXTEENTH * 16;
    // パッド（2小節ごと）
    if (s % 32 === 0) {
      for (const m of ch.tones.slice(0, 4)) {
        for (const det of [-9, 9]) {
          vnode('sawtooth', mtof(m), t, barLen * 2 + 0.6, 0.022, [musicBus, [reverbIn, 0.9]],
            { attack: 1.2, release: 1.4, sustain: true, lp: 700, sweep: 1500, detune: det });
        }
      }
    }
    // アルペジオ
    const arpEvery = mode === 'play' ? 1 : 2;
    if (pos % arpEvery === 0) {
      const idx = ARP[pos];
      const oct = (bar % 2 === 1 && pos >= 8) ? 12 : 0;
      const m = ch.tones[idx % ch.tones.length] + 12 + oct;
      const accent = pos % 4 === 0 ? 1 : 0.7;
      vnode('square', mtof(m), t, SIXTEENTH * 1.6, 0.03 * accent, [musicBus, [delayIn, 0.8], [reverbIn, 0.3]],
        { attack: 0.004, lp: mode === 'play' ? 2400 : 1500, sweep: 600, q: 4 });
    }
    // 澄んだきらめき（たまに）
    if (pos === 10 && (bar % 4 === 3) ) {
      const m = ch.tones[4] + 24;
      vnode('sine', mtof(m), t, 1.6, 0.03, [musicBus, [reverbIn, 1.0], [delayIn, 0.6]], { attack: 0.005 });
    }
    if (mode !== 'play') return;
    // ベース
    if (pos % 2 === 0) {
      const m = ch.root + (pos === 6 || pos === 14 ? 12 : 0);
      vnode('sawtooth', mtof(m), t, SIXTEENTH * 1.7, pos % 4 === 0 ? 0.075 : 0.05, [musicBus],
        { attack: 0.006, lp: 520, sweep: 160, q: 3 });
    }
    // キック（4つ打ち、やわらかく）
    if (pos % 4 === 0) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.35);
    }
    // ハイハット（ごく小さく）
    if (pos % 4 === 2) {
      const len = Math.floor(ctx.sampleRate * 0.04);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 9000;
      const g = ctx.createGain(); g.gain.value = 0.045;
      src.connect(f); f.connect(g); g.connect(musicBus); src.start(t);
    }
  }

  function startScheduler() {
    nextTime = ctx.currentTime + 0.1;
    scheduler = setInterval(() => {
      if (!ctx || mode === 'off' || muted || !musicOn) { nextTime = ctx ? ctx.currentTime + 0.1 : 0; return; }
      while (nextTime < ctx.currentTime + 0.15) {
        scheduleStep(step, nextTime);
        step++;
        nextTime += SIXTEENTH;
      }
    }, 30);
  }

  function applyMusicGain() {
    if (!ctx) return;
    const target = (mode === 'off' || !musicOn) ? 0.0001 : mode === 'play' ? 0.9 : mode === 'title' ? 0.75 : 0.45;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(target, ctx.currentTime, 0.4);
  }

  window.Sound = {
    unlock() { ensure(); applyMusicGain(); },
    step() { noise(0.025, 0.05, 2400); },
    turn() { tone(880, 0.06, 'sine', 0.07, 1180); },
    bump() {
      tone(150, 0.4, 'sine', 0.9, 50);
      tone(300, 0.25, 'triangle', 0.25, 90);
      noise(0.1, 0.35, 500);
      bell(1760, 0.02, 0.05, 1.0); // 鏡のキーン
    },
    whine() { tone(900, 0.35, 'sine', 0.1, 600, 0.35); },
    bone() { [1047, 1319, 1568].forEach((f, i) => bell(f, i * 0.07, 0.09, 0.6)); },
    sniff() { noise(0.07, 0.3, 3200, 0); noise(0.07, 0.3, 3200, 0.14); },
    warp() {
      tone(200, 0.8, 'sine', 0.2, 1600, 0, { rev: 0.8 });
      tone(1600, 0.8, 'sine', 0.08, 200, 0.1, { rev: 0.8 });
    },
    // やわらかい「ワン」
    bark(delay) {
      const d = delay || 0;
      tone(720, 0.16, 'triangle', 0.22, 430, d, { lp: 1800, attack: 0.012 });
      tone(360, 0.14, 'sine', 0.18, 240, d, { attack: 0.012 });
    },
    // クリア：きらきらしたベルのアルペジオ＋和音
    clear() {
      const seq = [72, 76, 79, 84, 88];
      seq.forEach((m, i) => bell(mtof(m), i * 0.11, 0.16, 1.4));
      [76, 79, 84].forEach(m => bell(mtof(m), 0.7, 0.1, 2.6));
      bell(mtof(96), 0.95, 0.05, 2.0);
    },
    music(m) { mode = m; if (ctx) applyMusicGain(); },
    setMuted(m) {
      muted = m;
      if (ctx) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
    },
    isMuted() { return muted; },
    setMusicOn(v) { musicOn = v; applyMusicGain(); },
    isMusicOn() { return musicOn; },
  };
})();
