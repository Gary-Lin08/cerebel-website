// Sound for the experience, synthesised with Web Audio: no files to load. Everything is quiet on purpose.
//
//  - a low pad that changes chord with each act and glides between them,
//  - air that rises with scroll speed (filtered noise),
//  - a soft glass note when a chapter begins,
//  - a tiny tick when the pointer reaches something you can press, and a soft press when you do.
//
// Browsers only allow audio after a press or a key, so nothing plays until the visitor's first one. The top-bar
// toggle turns it off and the choice is remembered in this browser.

// One chord per act (Hz), all close to each other so the glide between them stays smooth.
// One chord per act (Hz), all close to each other so the glide between them stays smooth. Kept above 100 Hz:
// laptop speakers do not reproduce the octave below, which made the first version silent on a MacBook.
const CHORDS: number[][] = [
  [110.0, 164.81, 220.0, 329.63], // Origin: A, open fifth
  [123.47, 185.0, 246.94, 369.99], // Motion: B
  [130.81, 196.0, 261.63, 392.0], // Snow: C, brighter
  [110.0, 164.81, 261.63, 329.63], // Benchmark: A with a sixth
  [98.0, 146.83, 196.0, 293.66], // Glasses: G, lower
  [116.54, 174.61, 233.08, 349.23], // Data loop: B flat
  [110.0, 164.81, 220.0, 277.18], // Field: A major
];
// New key: an earlier build could store "off" by mistake (see the click handler), so start everyone fresh.
const KEY = "cerebel-xp-sound-v2";

export function createSound(button: HTMLButtonElement) {
  let wanted = true;
  try {
    wanted = localStorage.getItem(KEY) !== "off";
  } catch {
    /* storage can be unavailable; default to on */
  }
  let ctx: AudioContext | null = null;
  let master: GainNode;
  let padBus: GainNode;
  let airGain: GainNode;
  let airFilter: BiquadFilterNode;
  let padFilter: BiquadFilterNode;
  let reverb: ConvolverNode;
  const voices: OscillatorNode[] = [];
  let act = -1;
  let chapter = "";
  let lastTick = 0;
  let level = 0;

  const reflect = () => {
    button.setAttribute("aria-pressed", String(wanted));
    const running = wanted && !!ctx && ctx.state === "running";
    button.classList.toggle("is-on", running);
    // Until the first press the browser keeps audio blocked; say so instead of looking switched off.
    button.classList.toggle("is-waiting", wanted && !running);
    const label = button.querySelector("em");
    if (label) label.textContent = wanted && !running ? "Click for sound" : "Sound";
    button.setAttribute("aria-label", running ? "Sound on. Turn off" : wanted ? "Turn sound on" : "Sound off. Turn on");
  };

  function build() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 6;
    master.connect(limiter).connect(ctx.destination);
    if (import.meta.env.DEV) {
      // Dev only: lets a headless test read the output level.
      const meter = ctx.createAnalyser();
      limiter.connect(meter);
      const buf = new Float32Array(meter.fftSize);
      (window as unknown as Record<string, unknown>).__xpSoundLevel = () => {
        meter.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        return Math.sqrt(sum / buf.length);
      };
    }

    // A short, dark room for everything to sit in.
    reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverb.connect(wet).connect(master);

    // Pad: four detuned triangles through a slowly breathing low-pass.
    padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 1100;
    padFilter.Q.value = 0.6;
    padBus = ctx.createGain();
    padBus.gain.value = 0.16;
    padFilter.connect(padBus);
    padBus.connect(master);
    padBus.connect(reverb);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 350;
    lfo.connect(lfoAmt).connect(padFilter.frequency);
    lfo.start();
    for (let i = 0; i < 4; i += 1) {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = CHORDS[0][i];
      o.detune.value = (i - 1.5) * 4;
      const g = ctx.createGain();
      g.gain.value = [0.9, 0.5, 0.32, 0.18][i];
      o.connect(g).connect(padFilter);
      o.start();
      voices.push(o);
    }

    // Air: pink-ish noise through a band-pass that opens with scroll speed.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    for (let i = 0; i < nd.length; i += 1) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.05;
      b1 = 0.96 * b1 + w * 0.3;
      nd[i] = (b0 + b1 + w * 0.1) * 0.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    airFilter = ctx.createBiquadFilter();
    airFilter.type = "bandpass";
    airFilter.frequency.value = 500;
    airFilter.Q.value = 0.7;
    airGain = ctx.createGain();
    airGain.gain.value = 0;
    src.connect(airFilter).connect(airGain);
    airGain.connect(master);
    airGain.connect(reverb);
    src.start();
  }

  function start() {
    if (!wanted) return;
    if (!ctx) build();
    if (!ctx) return;
    void ctx.resume().then(() => {
      master.gain.setTargetAtTime(0.9, ctx!.currentTime, 0.8);
      reflect();
    });
  }
  function stop() {
    if (!ctx) return;
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    window.setTimeout(() => {
      if (!wanted) void ctx?.suspend().then(reflect);
    }, 900);
  }

  // True when the press that unblocked audio was on the toggle itself; that press must not then switch it off.
  let unlockedByButton = false;
  const firstGesture = (e: Event) => {
    unlockedByButton = button.contains(e.target as Node);
    start();
    for (const type of ["pointerdown", "click", "keydown", "touchend"]) window.removeEventListener(type, firstGesture, { capture: true });
  };
  for (const type of ["pointerdown", "click", "keydown", "touchend"]) window.addEventListener(type, firstGesture, { capture: true });

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    // If sound was wanted but still blocked, this press is what unblocks it: do not also switch it off.
    // (The first build toggled here, so a visitor pressing "Sound" to hear it turned it off instead.)
    if (unlockedByButton || (wanted && !(ctx && ctx.state === "running"))) {
      unlockedByButton = false;
      start();
      return;
    }
    wanted = !wanted;
    try {
      localStorage.setItem(KEY, wanted ? "on" : "off");
    } catch {
      /* not remembered, still toggles */
    }
    if (wanted) start();
    else stop();
    reflect();
  });
  document.addEventListener("visibilitychange", () => {
    if (!ctx || !wanted) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });
  reflect();

  const live = () => !!ctx && wanted && ctx.state === "running";

  /** A single soft note with its own envelope, sent dry and to the room. */
  function note(freq: number, gain: number, attack: number, decay: number, type: OscillatorType = "sine") {
    if (!live()) return;
    const t = ctx!.currentTime;
    const o = ctx!.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx!.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g);
    g.connect(master);
    g.connect(reverb);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  // Pointer feedback on anything pressable.
  let hovered: Element | null = null;
  document.addEventListener("pointerover", (e) => {
    const el = (e.target as Element).closest?.("a, button, [data-cursor], input[type=range]");
    if (!el || el === hovered) return;
    hovered = el;
    const now = performance.now();
    if (now - lastTick < 70) return;
    lastTick = now;
    note(2200 + Math.random() * 200, 0.035, 0.002, 0.07);
  });
  document.addEventListener("pointerout", (e) => {
    if (hovered && !hovered.contains(e.relatedTarget as Node)) hovered = null;
  });
  document.addEventListener("click", (e) => {
    if (!(e.target as Element).closest?.("a, button, [data-cursor]")) return;
    note(220, 0.12, 0.004, 0.25, "triangle");
    note(1320, 0.04, 0.003, 0.4);
  });

  return {
    /** Called every frame with the act on screen, the chapter id and the scroll speed (screens per second). */
    update(nextAct: number, nextChapter: string | undefined, speed: number) {
      if (!live()) return;
      const t = ctx!.currentTime;
      if (nextAct !== act && nextAct >= 0) {
        act = nextAct;
        const chord = CHORDS[act % CHORDS.length];
        voices.forEach((o, i) => o.frequency.setTargetAtTime(chord[i], t, 1.4));
        padFilter.frequency.setTargetAtTime(act === 2 ? 1600 : 1100, t, 2);
      }
      if (nextChapter && nextChapter !== chapter) {
        const first = chapter === "";
        chapter = nextChapter;
        if (!first) {
          const chord = CHORDS[Math.max(0, act) % CHORDS.length];
          note(chord[3] * 2, 0.07, 0.01, 1.8);
          note(chord[2] * 4, 0.035, 0.03, 2.4);
        }
      }
      // Air follows scroll speed, never fully silent so it does not click in and out.
      level += (Math.min(1, Math.abs(speed) / 2.2) - level) * 0.08;
      airGain.gain.setTargetAtTime(0.012 + level * (act === 2 ? 0.22 : 0.13), t, 0.12);
      airFilter.frequency.setTargetAtTime(600 + level * (act === 2 ? 3000 : 1800), t, 0.15);
    },
  };
}
