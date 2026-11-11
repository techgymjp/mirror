/* WebAudio で鳴らす効果音（音声ファイル不要） */
(function () {
  'use strict';
  let ctx = null, master = null, muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, freqEnd, delay) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq, delay) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1000; f.Q.value = 1.2;
    const gn = ctx.createGain(); gn.gain.value = vol;
    src.connect(f); f.connect(gn); gn.connect(master);
    src.start(t);
  }

  window.Sound = {
    unlock: ensure,
    step() { noise(0.03, 0.08, 2200); },
    turn() { tone(760, 0.05, 'triangle', 0.08, 980); },
    bump() {
      tone(150, 0.4, 'sine', 0.9, 50);
      tone(300, 0.25, 'triangle', 0.25, 90);
      noise(0.12, 0.5, 500);
      tone(1800, 0.5, 'sine', 0.04, 1700, 0.02); // 鏡のキーン
    },
    whine() { tone(900, 0.35, 'sine', 0.12, 600, 0.35); },
    bone() { [880, 1175, 1568].forEach((f, i) => tone(f, 0.12, 'square', 0.08, null, i * 0.07)); },
    sniff() { noise(0.07, 0.35, 3200, 0); noise(0.07, 0.35, 3200, 0.14); },
    warp() {
      tone(200, 0.7, 'sine', 0.25, 1600);
      tone(1600, 0.7, 'triangle', 0.08, 200, 0.1);
    },
    bark(delay) {
      const d = delay || 0;
      tone(620, 0.14, 'sawtooth', 0.22, 300, d);
      tone(1240, 0.1, 'square', 0.05, 600, d);
      noise(0.08, 0.15, 1400, d);
    },
    clear() {
      this.bark(0); this.bark(0.22);
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.18, null, 0.5 + i * 0.11));
    },
    setMuted(m) { muted = m; },
    isMuted() { return muted; },
  };
})();
