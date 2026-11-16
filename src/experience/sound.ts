// Sound for the experience, synthesised with Web Audio: no files to load. Everything is quiet on purpose.
//
//  - a low pad that changes chord with each act and glides between them,
//  - air that rises with scroll speed (filtered noise),
//  - a soft glass note when a chapter begins,
//  - a tiny tick when the pointer reaches something you can press, and a soft press when you do.
//
// Browsers only allow audio after a press or a key, so nothing plays until the visitor's first one. The top-bar
// toggle turns it off and the choice is remembered in this browser.

// Everything is in one key, D major, so the pad, the chapter notes and the pointer ticks can never clash.
// Each act takes a different chord from that key (open voicings, no thirds stacked low), and every short note is
// taken from the D major pentatonic, which sits over all of them.
const N = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);
const CHORDS: number[][] = [
  [N(-19), N(-12), N(-5), N(2)], // Origin: D3 A3 E4 B4, Dadd9 open
  [N(-14), N(-7), N(-2), N(5)], // Motion: G3 D4 G4 D5
  [N(-12), N(-5), N(2), N(7)], // Snow: A3 E4 B4 E5, brighter
  [N(-22), N(-15), N(-10), N(-3)], // Benchmark: B2 F#3 B3 F#4
  [N(-14), N(-7), N(-3), N(2)], // Glasses: G3 D4 F#4 B4
  [N(-19), N(-12), N(-7), N(-3)], // Data loop: D3 A3 D4 F#4
  [N(-19), N(-12), N(-5), N(-3)], // Field: D3 A3 E4 F#4
];
// D major pentatonic, two octaves from D5, for chapter notes and ticks.
const BELLS = [5, 7, 9, 12, 14, 17, 19, 21, 24, 26].map(N);
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
    wet.gain.value = 0.7;
    reverb.connect(wet).connect(master);

    // Pad: four detuned triangles through a slowly breathing low-pass.
    padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 900;
    padFilter.Q.value = 0.6;
    padBus = ctx.createGain();
    padBus.gain.value = 0.045;
    padFilter.connect(padBus);
    padBus.connect(master);
    padBus.connect(reverb);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 220;
    lfo.connect(lfoAmt).connect(padFilter.frequency);
    lfo.start();
    for (let i = 0; i < 4; i += 1) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = CHORDS[0][i];
      o.detune.value = (i - 1.5) * 2.5;
      const g = ctx.createGain();
      g.gain.value = [0.8, 0.55, 0.32, 0.16][i];
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
      master.gain.setTargetAtTime(0.8, ctx!.currentTime, 0.8);
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
    note(BELLS[6 + Math.floor(Math.random() * 4)], 0.014, 0.003, 0.12);
  });
  document.addEventListener("pointerout", (e) => {
    if (hovered && !hovered.contains(e.relatedTarget as Node)) hovered = null;
  });
  document.addEventListener("click", (e) => {
    if (!(e.target as Element).closest?.("a, button, [data-cursor]")) return;
    note(N(-7), 0.06, 0.006, 0.3);
    note(N(9), 0.022, 0.004, 0.6);
  });

  return {
    /** Called every frame with the act on screen, the chapter id and the scroll speed (screens per second). */
    update(nextAct: number, nextChapter: string | undefined, speed: number) {
      if (!live()) return;
      const t = ctx!.currentTime;
      if (nextAct !== act && nextAct >= 0) {
        act = nextAct;
        const chord = CHORDS[act % CHORDS.length];
        voices.forEach((o, i) => o.frequency.setTargetAtTime(chord[i], t, 2.2));
        padFilter.frequency.setTargetAtTime(act === 2 ? 1200 : 900, t, 2);
      }
      if (nextChapter && nextChapter !== chapter) {
        const first = chapter === "";
        chapter = nextChapter;
        if (!first) {
          // Two bell notes from the pentatonic, a fifth or a fourth apart, quiet and long.
          const k = Math.floor(Math.random() * 6);
          note(BELLS[k], 0.04, 0.012, 2.2);
          note(BELLS[k + 3], 0.018, 0.06, 2.8);
        }
      }
      // Air follows scroll speed, never fully silent so it does not click in and out.
      level += (Math.min(1, Math.abs(speed) / 2.2) - level) * 0.08;
      airGain.gain.setTargetAtTime(0.004 + level * (act === 2 ? 0.14 : 0.08), t, 0.12);
      airFilter.frequency.setTargetAtTime(600 + level * (act === 2 ? 3000 : 1800), t, 0.15);
    },
  };
}
