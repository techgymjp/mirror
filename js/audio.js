/* WebAudio の効果音と BGM（音声ファイル不要）
 *
 * 効果音はページ読み込み時に OfflineAudioContext で「音声データ」として事前生成しておき、
 * 再生時はそのバッファを流すだけにする（その場で大量のオシレーターを鳴らすと、
 * 端末によっては音が途切れるため）。
 */
(function () {
  'use strict';
  let ctx = null, master = null, sfxBus = null, musicBus = null, reverbIn = null, delayIn = null;
  let muted = false, musicOn = true;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function makeImpulse(ac, sec, decay) {
    const len = Math.floor(ac.sampleRate * sec);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // ---------- 効果音の部品（任意の AudioContext 上で組み立てる） ----------
  function makeKit(ac, out, rev, t0) {
    function tone(freq, dur, type, vol, freqEnd, delay, opts) {
      opts = opts || {};
      const t = t0 + (delay || 0);
      const o = ac.createOscillator(), gn = ac.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(vol, t + (opts.attack || 0.008));
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = o;
      if (opts.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; o.connect(f); node = f; }
      node.connect(gn); panTo(gn, opts.pan).connect(out);
      if (opts.rev && rev) { const sg = ac.createGain(); sg.gain.value = opts.rev; gn.connect(sg); sg.connect(rev); }
      o.start(t); o.stop(t + dur + 0.05);
    }
    function noise(dur, vol, freq, delay, type) {
      const t = t0 + (delay || 0);
      const len = Math.max(1, Math.floor(ac.sampleRate * dur));
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource(); src.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 1000; f.Q.value = 1.2;
      const gn = ac.createGain(); gn.gain.value = vol;
      src.connect(f); f.connect(gn); gn.connect(out);
      src.start(t);
    }
    // 左右の定位
    function panTo(node, pan) {
      if (!pan || !ac.createStereoPanner) return node;
      const pn = ac.createStereoPanner(); pn.pan.value = pan;
      node.connect(pn);
      return pn;
    }
    // 「シュッ」という風切り音（ノイズの帯域を動かす）
    function whoosh(dur, vol, f0, f1, delay, pan) {
      const t = t0 + (delay || 0);
      const len = Math.max(1, Math.floor(ac.sampleRate * dur));
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(); src.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.2;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const gn = ac.createGain();
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(gn); panTo(gn, pan).connect(out);
      src.start(t);
    }
    // ベルのような澄んだ音（倍音を少し重ねたサイン波）
    function bell(freq, delay, vol, dur) {
      dur = dur || 1.6;
      tone(freq, dur, 'sine', vol, null, delay, { attack: 0.005, rev: 0.6 });
      tone(freq * 2, dur * 0.6, 'sine', vol * 0.25, null, delay, { attack: 0.005, rev: 0.6 });
      tone(freq * 3, dur * 0.3, 'sine', vol * 0.08, null, delay, { attack: 0.005, rev: 0.6 });
    }
    return { tone, noise, bell, whoosh };
  }

  // 効果音のレシピ（len = 残響込みの長さ・秒）
  const SFX = {
    step: { len: 0.1, fn: k => k.noise(0.025, 0.05, 2400) },
    turn: { len: 0.15, fn: k => k.tone(880, 0.06, 'sine', 0.07, 1180) },
    // フリック：左は下がる音で左から、右は上がる音で右から
    flickL: {
      len: 0.3, fn: k => {
        k.whoosh(0.16, 0.55, 3200, 900, 0, -0.55);
        k.tone(990, 0.12, 'sine', 0.16, 700, 0.02, { attack: 0.004, pan: -0.55 });
      },
    },
    flickR: {
      len: 0.3, fn: k => {
        k.whoosh(0.16, 0.55, 900, 3200, 0, 0.55);
        k.tone(700, 0.12, 'sine', 0.16, 990, 0.02, { attack: 0.004, pan: 0.55 });
      },
    },
    // 2回続けて後ろを向くとき
    flickU: {
      len: 0.45, fn: k => {
        k.whoosh(0.22, 0.5, 1200, 3600, 0);
        k.tone(880, 0.1, 'sine', 0.15, null, 0.02, { attack: 0.004 });
        k.tone(1320, 0.16, 'sine', 0.15, null, 0.11, { attack: 0.004 });
      },
    },
    bump: {
      len: 2.4, fn: k => {
        k.tone(150, 0.4, 'sine', 0.9, 50);
        k.tone(300, 0.25, 'triangle', 0.25, 90);
        k.noise(0.1, 0.35, 500);
        k.bell(1760, 0.02, 0.05, 1.0); // 鏡のキーン
      },
    },
    whine: { len: 0.8, fn: k => k.tone(900, 0.35, 'sine', 0.1, 600, 0.35) },
    bone: { len: 2.2, fn: k => [1047, 1319, 1568].forEach((f, i) => k.bell(f, i * 0.07, 0.09, 0.6)) },
    warp: {
      len: 3.2, fn: k => {
        k.tone(200, 0.8, 'sine', 0.2, 1600, 0, { rev: 0.8 });
        k.tone(1600, 0.8, 'sine', 0.08, 200, 0.1, { rev: 0.8 });
      },
    },
    // やわらかい「ワン」
    bark: {
      len: 0.3, fn: k => {
        k.tone(720, 0.16, 'triangle', 0.22, 430, 0, { lp: 1800, attack: 0.012 });
        k.tone(360, 0.14, 'sine', 0.18, 240, 0, { attack: 0.012 });
      },
    },
    // クリア：きらきらしたベルのアルペジオ＋和音
    clear: {
      len: 5.6, fn: k => {
        [72, 76, 79, 84, 88].forEach((m, i) => k.bell(mtof(m), i * 0.11, 0.16, 1.4));
        [76, 79, 84].forEach(m => k.bell(mtof(m), 0.7, 0.1, 2.6));
        k.bell(mtof(96), 0.95, 0.05, 2.0);
      },
    },
    // ほねで助かった：明るく上がる2音
    saved: {
      len: 2.4, fn: k => {
        k.bell(mtof(79), 0, 0.12, 1.0);
        k.bell(mtof(86), 0.12, 0.12, 1.4);
        k.bell(mtof(91), 0.24, 0.06, 1.6);
      },
    },
    // 遠くの雷（低いゴロゴロ）
    thunder: {
      len: 2.2, fn: k => {
        k.noise(1.6, 0.5, 120, 0.05, 'lowpass');
        k.noise(0.9, 0.35, 220, 0.25, 'lowpass');
        k.tone(55, 1.4, 'sine', 0.25, 38, 0.05);
      },
    },
    // ゲームオーバー：ゆっくり下がっていくベル
    gameover: {
      len: 6.0, fn: k => {
        [76, 72, 69, 64].forEach((m, i) => k.bell(mtof(m), 0.35 + i * 0.22, 0.12, 1.6));
        k.bell(mtof(57), 1.3, 0.08, 2.6);
      },
    },
  };

  // ---------- 事前生成（ページ読み込み時。ユーザー操作は不要） ----------
  const buffers = {};
  let preloadPromise = null;
  function renderOffline(name) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const rate = 44100, rec = SFX[name];
    const len = Math.ceil(rec.len * rate);
    const off = new OAC(2, len, rate);
    const out = off.createGain(); out.gain.value = 1; out.connect(off.destination);
    let rev = null;
    if (rec.len > 1) {
      const conv = off.createConvolver(); conv.buffer = makeImpulse(off, 2.4, 2.6);
      const revOut = off.createGain(); revOut.gain.value = 0.55;
      rev = off.createGain(); rev.connect(conv); conv.connect(revOut); revOut.connect(off.destination);
    }
    rec.fn(makeKit(off, out, rev, 0));
    return new Promise((resolve, reject) => {
      off.oncomplete = e => resolve(e.renderedBuffer);
      const r = off.startRendering();
      if (r && r.then) r.then(resolve, reject);
    }).then(buf => { buffers[name] = buf; });
  }
  function preload() {
    if (preloadPromise) return preloadPromise;
    if (!(window.OfflineAudioContext || window.webkitOfflineAudioContext)) return (preloadPromise = Promise.resolve());
    const names = Object.keys(SFX);
    // 1つずつ順番に（メインスレッドを長く止めないように）
    preloadPromise = names.reduce((pr, n) => pr.then(() => renderOffline(n).catch(() => { /* 失敗したらその場で合成 */ })), Promise.resolve());
    return preloadPromise;
  }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC({ latencyHint: 'balanced' }); } catch (e) { ctx = new AC(); }
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 3;
      master.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
      // BGM 用の残響（鏡の空間っぽく）
      const rev = ctx.createConvolver(); rev.buffer = makeImpulse(ctx, 2.4, 2.6);
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

  function play(name) {
    if (muted || !ensure()) return;
    const buf = buffers[name];
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(sfxBus);
      src.start(ctx.currentTime + 0.005);
    } else {
      // まだ生成できていなければ、その場で合成
      SFX[name].fn(makeKit(ctx, sfxBus, reverbIn, ctx.currentTime));
    }
  }

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
  let scheduler = null, step = 0, nextTime = 0, hatBuf = null;

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
      if (!hatBuf) {
        const len = Math.floor(ctx.sampleRate * 0.04);
        hatBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = hatBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
      const src = ctx.createBufferSource(); src.buffer = hatBuf;
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
    preload,
    readyCount: () => Object.keys(buffers).length,
    _buffers: buffers,
    unlock() { ensure(); applyMusicGain(); },
    step() { play('step'); },
    turn() { play('turn'); },
    flick(dir) { play(dir < 0 ? 'flickL' : dir > 0 ? 'flickR' : 'flickU'); },
    bump() { play('bump'); },
    whine() { play('whine'); },
    bone() { play('bone'); },
    warp() { play('warp'); },
    bark() { play('bark'); },
    clear() { play('clear'); },
    gameover() { play('gameover'); },
    saved() { play('saved'); },
    thunder() { play('thunder'); },
    music(m) { mode = m; if (ctx) applyMusicGain(); },
    setMuted(m) {
      muted = m;
      if (ctx) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
    },
    isMuted() { return muted; },
    setMusicOn(v) { musicOn = v; applyMusicGain(); },
    isMusicOn() { return musicOn; },
  };

  // 読み込み直後から効果音を準備しておく
  if (document.readyState === 'complete') setTimeout(preload, 0);
  else window.addEventListener('load', () => setTimeout(preload, 0));
})();
