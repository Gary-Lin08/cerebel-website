import headingOutlines from "./heading-outlines.json";
import { addEnvironments } from "./environments";
import { mountMuscleOrbit } from "./muscle-orbit";
import "@fontsource-variable/space-grotesk";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./experience.css";
import { benchmark, chapters, glassesParts, flywheelSteps } from "./data";
import { asset, page } from "./paths";
import { type Act, ENTER, RESTS, TOTAL, createStage, damp, sceneTime, smooth, spans } from "./stage";
import { createSnap } from "./snap";
import { createOrigin } from "./acts/origin";
import { type SwingData, createSwing } from "./acts/swing";
import { createBenchmark } from "./acts/benchmark";
import { createSki, skiPeak, type SkiValues } from "./acts/ski";
import { createGlasses } from "./acts/glasses";
import { createFlywheel } from "./acts/flywheel";
import { createField } from "./acts/field";

const lines = (...text: string[]) => text.map((t, i) => `<span class="ln" style="--i:${i}"><span data-t="${t}">${t}</span></span>`).join("");
const orb = (label: string, href: string, extra = "") =>
  `<a class="orb" href="${href}" ${extra} data-cursor><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="58"/><circle class="orb__arc" cx="60" cy="60" r="58"/></svg><span>${label}</span></a>`;

const findingIds = ["sway", "trail-knee", "lead-arm", "hang-back"];
const groups = [...new Set(chapters.map((c) => c.group))];
const chapterLabels: Record<string,string> = {"hero":"Introduction","legible":"Physical intelligence","swing-intro":"Swing overview","sway":"Hip shift","trail-knee":"Right knee","lead-arm":"Lead arm","hang-back":"Impact","finish":"Finish","find":"Explore swing","ski-intro":"Snowboard turn","ski-load":"Body load","ski-edge":"Edge control","benchmark":"Model comparison","glasses-intro":"Concept","g-optical":"Optical path","g-clock":"Shared clock","g-prep":"Data preparation","g-modular":"Modular design","loop-0":"Deploy","loop-1":"Capture","loop-2":"Validate","loop-3":"Improve","field":"Applications","company":"Team","contact":"Contact"};
const groupSpan = (g: string) => {
  const mine = spans.filter((s) => s.group === g);
  return { start: mine[0].start, end: mine[mine.length - 1].end };
};

function markup() {
  const seq = benchmark["32"];
  const peak = skiPeak();
  return /* html */ `
  <canvas class="xp-canvas" aria-hidden="true"></canvas>

  <header class="xp-top">
    <button class="xp-burger" type="button" aria-label="Open menu" aria-expanded="false" data-cursor><i></i><i></i></button>
    <a class="xp-mark" href="#hero" data-jump="0" aria-label="Cerebel AI"><img src="${asset("/assets/cerebel-wordmark.png")}" alt="Cerebel" width="595" height="194"></a>

    <nav class="xp-top__links" aria-label="Shortcuts">
      <a href="${page("/")}" data-cursor>Previous site ↗</a>
      <a class="xp-pill" href="mailto:hello@cerebel.tech?subject=Demo%20request" data-cursor><span class="xp-pill__line" aria-hidden="true"></span><span class="xp-pill__label">Request a demo</span></a>
    </nav>
  </header>

  <nav class="xp-rail" aria-label="Chapters">
    ${groups.map((g, i) => `<button type="button" data-group="${g}" data-cursor><span>${g}</span><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13"/><circle class="arc" cx="16" cy="16" r="13" pathLength="1"/><circle class="dot" cx="16" cy="16" r="2.2"/></svg><em>${String(i + 1).padStart(2, "0")}</em></button>`).join("")}
  </nav>

  <main class="xp-chapters">
    <section class="ch ch--hero" data-ch="hero" id="hero">
      <h1>${lines("Human motion.", "Made legible.")}</h1>
      <p class="lede">We make human physical intelligence legible to machines.</p>
    </section>

    <section class="ch" data-ch="legible">
      <h2>${lines("From a field", "of signals", "to a body", "in motion.")}</h2>
      <p>CeRebel is our motion model. It recovers articulated body motion from what a wearable sees, and turns it into something a coach, a device or a robot can read.</p>
      <p class="meta"><span class="num">50.45M</span> model parameters</p>
    </section>

    <section class="ch" data-ch="swing-intro">
      <p class="badge" data-swing="badge"></p>
      <h2>${lines("One swing.", "Every frame", "measured.")}</h2>
      <p>A phone video of one of our own team, reconstructed. Scroll to move through the swing; it stops where the numbers matter.</p>
      <p class="fine" data-swing="club"></p>
    </section>

    ${findingIds.map((id) => `
    <section class="ch ch--finding" data-ch="${id}">
      <p class="metric num" data-f="${id}" data-k="value"></p>
      <p class="metric-cap" data-f="${id}" data-k="caption"></p>
      <h2 class="h-sm" data-f="${id}" data-k="title"></h2>
      <p data-f="${id}" data-k="detail"></p>
      <div class="trace" data-trace="${id}"></div>
      <p class="fix"><b>Fix</b><span data-f="${id}" data-k="cue"></span></p>
    </section>`).join("")}

    <section class="ch" data-ch="finish">
      <h2>${lines("And what", "already works.")}</h2>
      <ul class="plain" data-swing="highlights"></ul>
      <p class="fine" data-swing="coaching"></p>
    </section>

    <section class="ch ch--find" data-ch="find">
      <h2>${lines("Your turn.")}</h2>
      <p>Drag the timeline. Find the frame where the hips slide furthest away from the target.</p>
      <p class="metric num"><span data-find="value">0.0</span><small>cm</small></p>
      <p class="metric-cap" data-find="status">Hip shift toward the target</p>
    </section>

    <section class="ch ch--ski" data-ch="ski-intro">
      <p class="badge badge--teal">Illustrative model · not a capture</p>
      <h2>${lines("Next: the load", "a turn puts", "on a skeleton.")}</h2>
      <p>We have not published a snowboard capture yet. This is a carved turn modelled from two inputs, ${peak.kmh.toFixed(0)} km/h and a ${peak.radius.toFixed(0)} m arc, to show what the analysis reads on snow.</p>
    </section>

    <section class="ch ch--ski" data-ch="ski-load">
      <p class="metric num"><span data-ski="load">1.0</span><small>× body weight</small></p>
      <p class="metric-cap">Carried through the legs, right now</p>
      <h2 class="h-sm">${lines("Load follows the turn.")}</h2>
      <p>Gravity is constant; the turn is not. At the apex of this arc the two add up to ${peak.load.toFixed(1)} times body weight, and all of it reaches the snow through two legs and one edge.</p>
      <p class="fine">Computed from the modelled speed and arc. Not measured.</p>
    </section>

    <section class="ch ch--ski" data-ch="ski-edge">
      <p class="metric num"><span data-ski="lean">0</span><small>° lean</small></p>
      <p class="metric-cap">The angle that balances the load</p>
      <h2 class="h-sm">${lines("Lean is the answer", "to the force.")}</h2>
      <p>The body tilts until gravity and the turn line up through the edge of the board. The model computes that angle, up to ${peak.lean.toFixed(0)}° here. A capture will measure it, joint by joint.</p>
      <p class="fine">Computed from the modelled speed and arc. Not measured.</p>
    </section>

    <section class="ch ch--bench" data-ch="benchmark">
      <p class="metric num"><span data-bench="lead">0.0</span><small>mm</small></p>
      <p class="metric-cap">Head-trajectory error on AMASS. Lower is better.</p>
      <h2 class="h-sm">${lines("CeRebel leads", "the published", "methods.")}</h2>
      <p>Four methods on one millimetre scale, starting from zero. The next published method sits at <span class="num" data-bench="next">${seq[1][4]}</span> mm.</p>
      <div class="seg" role="group" aria-label="Sequence length">
        <button type="button" data-seq="32" class="is-on" data-cursor>SEQ 32</button>
        <button type="button" data-seq="128" data-cursor>SEQ 128</button>
      </div>
      <table class="mini">
        <thead><tr><th>Method</th><th>MPJPE</th><th>PA-MPJPE</th><th>GND</th></tr></thead>
        <tbody data-bench="table"></tbody>
      </table>
    </section>

    <section class="ch" data-ch="glasses-intro">
      <p class="badge">Development concept</p>
      <h2>${lines("The glasses,", "taken apart.")}</h2>
      <p>In-lens display and camera capture are intended capabilities of this concept. It is not a working product yet, and features and timing can change.</p>
      ${orb("Become a backer", page("/#wearable"))}
    </section>

    ${glassesParts.map((p) => `
    <section class="ch ch--part" data-ch="${p.id}">
      <p class="index num">${p.n}<small>/ 04</small></p>
      <h2 class="h-sm">${lines(p.title)}</h2>
      <p>${p.copy}</p>
      <p class="fine">Schematic of the development configuration.</p>
    </section>`).join("")}

    ${flywheelSteps.map((step,i)=>`<section class="ch ch--flywheel" data-ch="loop-${i}">
      <h2 class="h-sm">${lines(...step.head)}</h2>
      <p>${step.copy}</p>
      <p class="loop-detail num">${step.detail}</p>
      <div class="loop-total"><strong class="num">20,000<span> h</span></strong><p>5,000 real / 15,000 simulated</p></div>
      <p class="fine">Team-reported dataset. Every deployment can strengthen the motion model. Loop shown schematically.</p>
    </section>`).join("")}
    <section class="ch ch--field" data-ch="field">
      <h2>${lines("Already", "in the field.")}</h2>
      <ul class="partners">
        <li><a href="https://apocynthion.ai/" target="_blank" rel="noreferrer" data-cursor><b>Apocynthion</b><span>Humanoid partnership. Its ArenaLabs line builds AlphaMotion, described on its site as the cerebellum for humanoid robots.</span><i>↗</i></a></li>
        <li><a href="${page("/")}" data-cursor><b>Athletic coaching</b><span>Ski, golf and tennis: edge, rotation, contact.</span><i>↗</i></a></li>
        <li><a href="https://www.instagram.com/overide_snowboards/" target="_blank" rel="noreferrer" data-cursor><b>Overide</b><span>Snowboard brand partnership. 雪鸮科技 / 风脊者, Overide Halo.</span><i>↗</i></a></li>
      </ul>
    </section>

    <section class="ch ch--company" data-ch="company">
      <h2>${lines("Built by people", "who move.")}</h2>
      <p>The founding team comes from Babson / Olin, Duke, USC Marshall and USC Viterbi, with an adviser from the Wharton School.</p>
      <p class="fine">Academic affiliations of the team, not institutional partnerships.</p>
      <figure class="slant"><img src="${asset("/assets/founders/founder-team-sm.jpg")}" alt="The Cerebel team" loading="lazy"></figure>
    </section>

    <section class="ch ch--contact" data-ch="contact">
      <h2>${lines("Built for the", "real world, not", "only the lab.")}</h2>
      ${orb("Request a demo", "mailto:hello@cerebel.tech?subject=Demo%20request")}
      <footer class="xp-foot">
        <div class="xp-foot__marks">
          <img class="wm" src="${asset("/assets/cerebel-wordmark.png")}" alt="Cerebel" width="595" height="194">
          <img class="nv" src="${asset("/assets/nvidia-inception-program-badge.svg")}" alt="Cerebel is a member of NVIDIA Inception">
          <span class="usc"><img src="${asset("/assets/affiliations/usc-marshall-white.svg")}" alt="USC Marshall"><em>Greif Incubator</em></span>
        </div>
        <p><a href="mailto:hello@cerebel.tech" data-cursor>hello@cerebel.tech</a> · <a href="${page("/privacy.html")}" data-cursor>Privacy</a> · <a href="${page("/")}" data-cursor>Previous site</a></p>
        <p class="legal">© ${new Date().getFullYear()} NVIDIA, the NVIDIA logo, and NVIDIA Inception are trademarks and/or registered trademarks of NVIDIA Corporation in the U.S. and other countries.</p>
      </footer>
    </section>
  </main>

  <nav class="loop-nav" aria-label="Data flywheel stages">${flywheelSteps.map((step,i)=>`<button data-loop="${i}" data-jump="${spans.find(s=>s.id===`loop-${i}`)!.start+.1}"><span>0${i+1}</span>${step.title}<i>↗</i></button>`).join("")}</nav>
  <div class="xp-anchors" aria-hidden="true">
    ${seq.map((row, i) => `<div class="tag tag--bar${i === 0 ? " is-lead" : ""}" data-anchor="bar-${i}"><b>${row[0]}</b><span class="num" data-bar="${i}">0.0</span></div>`).join("")}
    ${[0, 20, 40, 60, 80].map((mm) => `<div class="tag tag--tick num" data-anchor="tick-${mm}">${mm}</div>`).join("")}
    <div class="tag tag--gap" data-anchor="gap"><span class="num" data-bench="gap"></span><em>mm between them</em></div>
    <div class="tag tag--ski" data-anchor="ski-force"><b class="num"><span data-ski="load2">1.0</span>×</b><span>through the legs</span></div>
    <div class="tag tag--ski tag--skiforce tag--weight" data-anchor="ski-weight"><b class="num">1.0×</b><span>weight</span></div>
    <div class="tag tag--ski tag--skiforce tag--turn" data-anchor="ski-turn"><b class="num"><span data-ski="turn">0.0</span>×</b><span>turn force</span></div>
    <div class="joint" data-anchor="joint"><i></i><div><b class="num" data-joint="value"></b><span data-joint="caption"></span></div></div>
    <div class="tag tag--fig" data-anchor="fig-surface">Body surface</div>
    <div class="tag tag--fig" data-anchor="fig-skeleton">Skeleton + muscles</div>
    ${glassesParts.map((p) => `<div class="hot" data-anchor="h-${p.id.slice(2)}" data-hot="${p.id}"><i></i><span><b class="num">${p.n}</b>${p.title}</span></div>`).join("")}
  </div>

  <div class="glasses-controls">
    <div class="glasses-drag" tabindex="0" role="group" aria-label="Rotate glasses: drag or use arrow keys; Home to reset"></div>
    <div class="glasses-help"><span>Drag to rotate</span><button class="glasses-reset" type="button">Reset view</button></div>
  </div>
  <div class="xp-swinghud">
    <div class="xp-readout" data-hud="readout" aria-hidden="true"></div>
    <div class="xp-swinghud__row" aria-hidden="true"><span data-hud="phase">Address</span><span class="num" data-hud="frame">000 / 096</span></div>
    <div class="xp-swinghud__bar" data-hud="bar" role="slider" aria-label="Swing frame" aria-valuemin="0" aria-valuemax="96" aria-valuenow="0" tabindex="-1"><i data-hud="head"></i><u data-hud="knob"></u><div data-hud="phases"></div></div>
  </div>

  <div class="xp-skidata" aria-hidden="true">
    <div><span>Speed</span><b class="num" data-ski="kmh">0</b><em>km/h</em></div>
    <div><span>Turn radius</span><b class="num" data-ski="radius">0</b><em>m</em></div>
    <div><span>Lean</span><b class="num" data-ski="lean2">0</b><em>°</em></div>
    <div><span>Load</span><b class="num" data-ski="load3">1.0</b><em>× BW</em></div>
  </div>

  ${[2].map(act=>{ const sections=spans.filter(s=>s.act===act); return `<nav class="scene-timeline" data-timeline="${act}" aria-label="Snow chapter navigation"><div class="scene-timeline__top"><span>Snowboard</span><span data-timeline-label></span></div><input type="range" min="${sections[0].start+.02}" max="${sections[sections.length-1].end-.08}" step="0.005" value="${sections[0].start+.02}" aria-label="Snow chapter progress"><div class="scene-timeline__stops">${sections.map(s=>`<button type="button" data-subchapter="${s.id}" data-jump="${s.start+.3}">${chapterLabels[s.id]}</button>`).join("")}</div></nav>`; }).join("")}
  <div class="xp-hint" aria-hidden="true"><span>Scroll to discover</span><i></i></div>

  <div class="xp-menu" aria-hidden="true">
    <p class="fine">Explore the story</p>
    <ol>${groups.map((g, i) => `<li><button class="menu-chapter" type="button" data-group="${g}" data-cursor><em>Chapter ${i + 1}</em>${g}</button><nav class="menu-subchapters" aria-label="${g} subchapters">${spans.filter(s=>s.group===g).map(s=>`<button type="button" data-subchapter="${s.id}" data-jump="${s.start+.3}">${chapterLabels[s.id]}</button>`).join("")}</nav></li>`).join("")}</ol>
  </div>

  <div class="xp-loader"><div class="xp-loader__halo" aria-hidden="true"></div><div class="xp-loader__content"><span class="xp-loader__eyebrow">HUMAN MOTION / MACHINE INTELLIGENCE</span><img src="${asset("/assets/cerebel-wordmark.png")}" alt="Cerebel" width="595" height="194"><div class="xp-loader__track" role="progressbar" aria-label="Loading experience" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i class="xp-loader__fill"></i></div><span class="xp-loader__caption">PREPARING THE EXPERIENCE</span></div><span class="xp-loader__signature" aria-hidden="true">CEREBEL AI</span></div>
  <div class="xp-glass" aria-hidden="true"></div>
  <canvas class="xp-lens" aria-hidden="true"></canvas>
  <div class="xp-cursor" aria-hidden="true"></div>`;
}

export function mountExperience(root: HTMLElement) {
  document.documentElement.classList.add("xp-root");
  root.className = "xp";
  root.innerHTML = markup();
  const spacer = document.createElement("div");
  spacer.className = "xp-spacer";
  document.body.appendChild(spacer);
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const $$ = <T extends HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)];

  // More physical scroll per scene unit makes small wheel and trackpad motions easier to control.
  const scrollDistanceScale = 2;
  let vh = window.innerHeight;
  const pixelsPerUnit = () => vh * scrollDistanceScale;
  let vw = window.innerWidth;
  const layout = () => {
    // Ignore mobile address-bar height changes so the scroll map does not jump.
    if (window.innerWidth !== vw || Math.abs(window.innerHeight - vh) > 120) {
      vw = window.innerWidth;
      vh = window.innerHeight;
    }
    spacer.style.height = `${TOTAL * pixelsPerUnit() + 0.62 * vh}px`;
  };
  layout();
  window.addEventListener("resize", layout);
  let snap: ReturnType<typeof createSnap> | null = null;
  // Menu and chapter buttons go to the rest point of the chapter they name.
  const jump = (units: number) => {
    const i = Math.max(0, spans.findIndex((s) => units >= s.start && units < s.end));
    const top = RESTS[i] * pixelsPerUnit();
    if (snap && !stage.reduced) snap.to(top);
    else window.scrollTo({ top, behavior: "auto" });
  };

  // ---- Swing: copy and traces come from the capture's own analysis file.
  let swing: SwingData | null = null;
  const traceDots: { el: SVGCircleElement; values: number[]; min: number; max: number }[] = [];
  const W = 300;
  const H = 70;
  function fillSwing(d: SwingData) {
    swing = d;
    mountMuscleOrbit(root, d);
    $('[data-swing="badge"]').textContent = d.disclosure.badge;
    $('[data-swing="club"]').textContent = d.disclosure.club;
    $('[data-swing="coaching"]').textContent = d.disclosure.coaching;
    $('[data-swing="highlights"]').innerHTML = d.highlights.map((h) => `<li>${h}</li>`).join("");
    for (const a of d.annotations) {
      $$(`[data-f="${a.id}"]`).forEach((el) => {
        const k = el.dataset.k!;
        el.textContent = k === "value" ? a.metric.value : k === "caption" ? a.metric.caption : (a as unknown as Record<string, string>)[k];
      });
      const series = d.series.find((s) => s.id === a.series);
      const host = root.querySelector<HTMLElement>(`[data-trace="${a.id}"]`);
      if (!series || !host) continue;
      const min = Math.min(...series.values, a.goal?.value ?? Infinity);
      const max = Math.max(...series.values, a.goal?.value ?? -Infinity);
      const x = (i: number) => (i / (series.values.length - 1)) * W;
      const y = (v: number) => H - 6 - ((v - min) / (max - min || 1)) * (H - 12);
      const path = series.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
      const goal = a.goal ? `<line class="goal" x1="0" x2="${W}" y1="${y(a.goal.value)}" y2="${y(a.goal.value)}"/><text x="${W}" y="${y(a.goal.value) - 5}" text-anchor="end">${a.goal.label}</text>` : "";
      host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><rect class="win" x="${x(a.start)}" width="${x(a.end) - x(a.start)}" y="0" height="${H}"/>${goal}<path d="${path}"/><circle r="3.5"/></svg><span>${series.label} (${series.unit})</span>`;
      traceDots.push({ el: host.querySelector("circle")!, values: series.values, min, max });
    }
    $('[data-hud="readout"]').innerHTML = d.series.map((sr) => `<div data-series="${sr.id}"><span>${sr.label}</span><b class="num">0.0</b><em>${sr.unit}</em></div>`).join("");
    readouts = d.series.map((sr) => ({ id: sr.id, values: sr.values, el: root.querySelector<HTMLElement>(`[data-series="${sr.id}"] b`)!, cell: root.querySelector<HTMLElement>(`[data-series="${sr.id}"]`)! }));
    const sway = d.series.find((sr) => sr.id === "sway")!;
    swayValues = sway.values;
    bestFrame = sway.values.indexOf(Math.min(...sway.values));
    const last = d.frameCount - 1;
    hudBar.setAttribute("aria-valuemax", String(last));
    $('[data-hud="phases"]').innerHTML = d.phases.map((p) => `<span style="left:${(p.start / last) * 100}%">${p.label}</span>`).join("");
  }
  let readouts: { id: string; values: number[]; el: HTMLElement; cell: HTMLElement }[] = [];
  let swayValues: number[] = [];
  let bestFrame = 0;
  let scrub: number | null = null;
  let found = false;
  const at = (values: number[], frame: number) => {
    const i = Math.max(0, Math.min(Math.floor(frame), values.length - 2));
    return values[i] + (values[i + 1] - values[i]) * (frame - i);
  };
  const hudBar = $('[data-hud="bar"]');
  const hudKnob = $('[data-hud="knob"]');
  const jointEl = $('[data-anchor="joint"]');
  const jointValue = $('[data-joint="value"]');
  const jointCaption = $('[data-joint="caption"]');
  const findValue = $('[data-find="value"]');
  const findStatus = $('[data-find="status"]');
  let jointShown: string | null = null;
  const hudPhase = $('[data-hud="phase"]');
  const hudFrame = $('[data-hud="frame"]');
  const hudHead = $('[data-hud="head"]');
  let lastFrameShown = -1;
  function showFrame(frame: number, focus: string | null, zoom: number) {
    if (!swing) return;
    const f = Math.round(frame);
    const last = swing.frameCount - 1;
    hudHead.style.transform = `scaleX(${frame / last})`;
    hudKnob.style.left = `${(frame / last) * 100}%`;
    const activeSeries = swing.annotations.find((a) => a.id === focus)?.series;
    for (const r of readouts) {
      r.el.textContent = at(r.values, frame).toFixed(1);
      r.cell.classList.toggle("is-on", r.id === activeSeries);
    }
    // The measured value rides on the joint it belongs to.
    if (focus && focus !== jointShown) {
      const a = swing.annotations.find((x) => x.id === focus)!;
      jointValue.textContent = a.metric.value;
      jointCaption.textContent = a.metric.caption;
      jointShown = focus;
    }
    jointEl.classList.toggle("is-on", zoom > 0.55);
    if (root.classList.contains("is-scrub")) {
      const v = at(swayValues, frame);
      findValue.textContent = v.toFixed(1);
      const hit = scrub !== null && Math.abs(frame - bestFrame) <= 1.5;
      if (hit) found = true;
      findStatus.textContent = hit
        ? `Found it. Frame ${String(bestFrame).padStart(3, "0")}: ${Math.abs(swayValues[bestFrame]).toFixed(0)} cm away from the target.`
        : found ? "Hip shift toward the target. You found the frame; keep exploring." : "Hip shift toward the target";
      findStatus.classList.toggle("is-hit", hit);
    }
    for (const t of traceDots) {
      const i = Math.min(Math.floor(frame), t.values.length - 2);
      const v = t.values[i] + (t.values[i + 1] - t.values[i]) * (frame - i);
      t.el.setAttribute("cx", ((frame / (t.values.length - 1)) * W).toFixed(1));
      t.el.setAttribute("cy", (H - 6 - ((v - t.min) / (t.max - t.min || 1)) * (H - 12)).toFixed(1));
    }
    if (f === lastFrameShown) return;
    lastFrameShown = f;
    hudFrame.textContent = `${String(f).padStart(3, "0")} / ${String(last).padStart(3, "0")}`;
    hudPhase.textContent = swing.phases.find((p) => f >= p.start && f <= p.end)?.label ?? "";
  }

  // ---- Benchmark labels.
  let seqKey: "32" | "128" = "32";
  const barEls = $$("[data-bar]");
  const leadEl = $('[data-bench="lead"]');
  const gapEl = $('[data-bench="gap"]');
  const fillBenchTable = () => {
    const rows = benchmark[seqKey];
    $('[data-bench="table"]').innerHTML = rows.map((r, i) => `<tr class="${i === 0 ? "is-lead" : ""}"><th>${r[0]}</th><td>${r[1].toFixed(1)}</td><td>${r[2].toFixed(1)}</td><td>${r[3].toFixed(2)}</td></tr>`).join("");
    $('[data-bench="next"]').textContent = String(rows[1][4]);
  };
  fillBenchTable();
  $$<HTMLButtonElement>("[data-seq]").forEach((b) => b.addEventListener("click", () => {
    seqKey = b.dataset.seq as "32" | "128";
    $$("[data-seq]").forEach((x) => x.classList.toggle("is-on", x === b));
    fillBenchTable();
  }));
  function showBench(shown: number[], gapOn: number) {
    barEls.forEach((el, i) => (el.textContent = shown[i].toFixed(1)));
    leadEl.textContent = shown[0].toFixed(1);
    const rows = benchmark[seqKey];
    // Only the reported values and their difference are shown.
    gapEl.textContent = (rows[1][4] - rows[0][4]).toFixed(1);
    root.style.setProperty("--gap", gapOn.toFixed(3));
  }

  const skiEls = Object.fromEntries($$<HTMLElement>("[data-ski]").map((el) => [el.dataset.ski!, el]));
  const skiForceTags = $$<HTMLElement>(".tag--skiforce");
  function showSki(v: SkiValues) {
    skiEls.turn.textContent = v.turn.toFixed(1);
    skiForceTags.forEach((el, i) => (el.style.opacity = (i === 1 ? v.forces * Math.min(1, v.turn / 0.3) : v.forces).toFixed(2)));
    const load = v.load.toFixed(1);
    skiEls.load.textContent = skiEls.load2.textContent = skiEls.load3.textContent = load;
    skiEls.lean.textContent = skiEls.lean2.textContent = v.lean.toFixed(0);
    skiEls.kmh.textContent = v.kmh.toFixed(0);
    skiEls.radius.textContent = Number.isFinite(v.radius) && v.radius < 400 ? v.radius.toFixed(0) : "–";
  }

  let entranceStartedAt: number | null = null;
  const acts: Act[] = [
    createOrigin(() => entranceStartedAt === null ? 0 : Math.max(0, (performance.now() - entranceStartedAt) / 1200)),
    createSwing(fillSwing, showFrame, () => scrub),
    createSki(showSki),
    createBenchmark(() => seqKey, showBench),
    createGlasses($(".glasses-controls")),
    createFlywheel(step => root.querySelectorAll<HTMLButtonElement>("[data-loop]").forEach((button,i)=>button.setAttribute("aria-current",String(i===step)))),
    createField(),
  ];
  addEnvironments(acts);
  const stage = createStage($<HTMLCanvasElement>(".xp-canvas"), acts, $(".xp-anchors"));

  // ---- Loader.
  const loader = $(".xp-loader");
  const loaderTrack = loader.querySelector<HTMLElement>(".xp-loader__track")!;
  const loaderFill = loader.querySelector<HTMLElement>(".xp-loader__fill")!;
  const loadingStartedAt = performance.now();
  let homeReady = false;
  acts[0].ready.then(() => { homeReady = true; });
  // Later scenes load concurrently, but do not block the landing page.
  acts.slice(1).forEach(a => a.ready.catch(error => console.error("Scene loading failed", error)));
  let started = false;

  // ---- Chrome.
  const chEls = $$<HTMLElement>("[data-ch]").map((el) => ({ el, span: spans.find((s) => s.id === el.dataset.ch)! }));
  const railEls = $$<HTMLButtonElement>(".xp-rail [data-group]").map((el) => ({ el, arc: el.querySelector<SVGCircleElement>(".arc")!, ...groupSpan(el.dataset.group!) }));
  const hots = $$<HTMLElement>("[data-hot]");
  $$<HTMLElement>("[data-group]").forEach((el) => el.addEventListener("click", () => {
    setMenu(false);
    jump(groupSpan(el.dataset.group!).start + (el.dataset.group === "Origin" ? 0 : .86));
  }));
  $$<HTMLElement>("[data-jump]").forEach((el) => el.addEventListener("click", (e) => {
    e.preventDefault();
    setMenu(false);
    jump(Number(el.dataset.jump));
  }));
  hots.forEach((el) => {
    el.style.pointerEvents = "auto";
    el.addEventListener("click", () => jump(spans.find((s) => s.id === el.dataset.hot)!.start + 0.3));
  });
  const burger = $<HTMLButtonElement>(".xp-burger");
  const menu = $(".xp-menu");
  function setMenu(open: boolean) {
    root.classList.toggle("is-menu", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.setAttribute("aria-hidden", String(!open));
  }
  burger.addEventListener("click", () => setMenu(!root.classList.contains("is-menu")));
  window.addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

  const cursor = $(".xp-cursor");
  const cur = { x: -100, y: -100, tx: -100, ty: -100, vx: 0, vy: 0 };
  window.addEventListener("pointermove", (e) => {
    if (cur.tx === -100) {cur.x=e.clientX;cur.y=e.clientY;}
    cur.tx = e.clientX;
    cur.ty = e.clientY;
    cursor.classList.toggle("is-hover", !!(e.target as Element).closest?.("a, button, [data-cursor]"));
  });

  // ---- Scrubbing the swing in the last Motion chapter.
  const scrubTo = (clientX: number) => {
    if (!swing) return;
    const r = hudBar.getBoundingClientRect();
    scrub = Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (swing.frameCount - 1);
    hudBar.setAttribute("aria-valuenow", String(Math.round(scrub)));
  };
  hudBar.addEventListener("pointerdown", (e) => {
    if (!root.classList.contains("is-scrub")) return;
    hudBar.setPointerCapture(e.pointerId);
    scrubTo(e.clientX);
  });
  hudBar.addEventListener("pointermove", (e) => hudBar.hasPointerCapture(e.pointerId) && scrubTo(e.clientX));
  hudBar.addEventListener("keydown", (e) => {
    if (!swing || !root.classList.contains("is-scrub")) return;
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    scrub = Math.min(swing.frameCount - 1, Math.max(0, (scrub ?? 0) + step));
    hudBar.setAttribute("aria-valuenow", String(Math.round(scrub)));
  });

  const timelines = $$<HTMLElement>("[data-timeline]").map(el=>({el,input:el.querySelector<HTMLInputElement>("input")!,label:el.querySelector<HTMLElement>("[data-timeline-label]")!}));
  let timelineDragging = false;
  // A drag that ends outside the slider must still end the drag.
  window.addEventListener("pointerup", () => { timelineDragging = false; }, { passive: true });
  for (const {input} of timelines) {
    input.addEventListener("pointerdown",()=>{timelineDragging=true;});
    for(const event of ["pointerup","pointercancel","lostpointercapture"]) input.addEventListener(event,()=>{timelineDragging=false;snap?.settle();});
    input.addEventListener("input",()=>{scrub=null;u=Number(input.value);window.scrollTo({top:u*pixelsPerUnit(),behavior:"instant"});});
  }
  const subchapterButtons=$$<HTMLElement>("[data-subchapter]");

  // ---- Headline lens: under the pointer the letters fall back to outlines and a small constellation shows.
  // The constellation is a small 3D cloud drawn live: it turns, breathes, and each node trails the pointer at its own pace.
  const lens = root.querySelector<HTMLCanvasElement>(".xp-lens")!;
  const lensCtx = lens.getContext("2d")!;
  // Permanent seeded particles across the viewport; the pointer reveals a local window.
  const nodes = Array.from({length: 1080}, (_,i) => ({
    id: i, ox: 0, oy: 0, vx: 0, vy: 0, fx: 0, fy: 0, pz: 0,
    x: ((Math.sin(i * 127.1 + 3.7) * 43758.5453) % 1 + 1) % 1,
    y: ((Math.sin(i * 311.7 + 9.1) * 19341.337) % 1 + 1) % 1,
    z: Math.sin(i * 19.17) * 32, angle: 0, alpha: 0, sx: 0, sy: 0,
    size: 1.8 + Math.pow(((i * .61803398875) % 1), 1.7) * 4.6,
  }));
  const bonds = new Map<string,{a:typeof nodes[number];b:typeof nodes[number];alpha:number}>();
  const glyphContours = new Map<string,{path:Path2D;length:number}[]>();
  for(const [char,paths] of Object.entries(headingOutlines.glyphs)) {
    glyphContours.set(char,paths.map(d=>{
      const svgPath=document.createElementNS("http://www.w3.org/2000/svg","path");svgPath.setAttribute("d",d);
      return {path:new Path2D(d),length:svgPath.getTotalLength()};
    }));
  }
  // Whole-glyph paths (outer contour and counters together), used to keep the inward fill inside the letter.
  const glyphShapes = new Map<string,Path2D>();
  for(const [char,paths] of Object.entries(headingOutlines.glyphs)) glyphShapes.set(char,new Path2D(paths.join(" ")));
  const baselines = new WeakMap<HTMLElement,HTMLElement>();
  let lensOn = false;
  let lensTarget = 0;
  let lensStrength = 0;
  let pointerPresent = false;
  let textRadius = 64;
  function sizeLens() {
    const k = Math.min(window.devicePixelRatio || 1, 2);
    lens.width = Math.round(window.innerWidth * k);
    lens.height = Math.round(window.innerHeight * k);
    lensCtx.setTransform(k, 0, 0, k, 0, 0);
  }
  sizeLens();
  window.addEventListener("resize", sizeLens);
  function drawLens(time: number, dt: number) {
    lensCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    lensStrength = damp(lensStrength, lensTarget, 7, dt);
    const visible: typeof nodes = [];
    const local: typeof nodes = [];
    const particleRadius = Math.max(88, textRadius * 1.25);
    const h=Math.min(dt,1/30);
    for(const n of nodes){
      const bx=n.x*innerWidth, by=n.y*innerHeight;
      const dx=cur.x-(bx+n.ox), dy=cur.y-(by+n.oy);
      const distance=Math.hypot(dx,dy);
      // Anchor memory prevents the whole field being dragged along with the pointer.
      n.fx=-n.ox*16; n.fy=-n.oy*16;
      if(lensOn && Math.hypot(cur.x-bx,cur.y-by)<particleRadius+20){
        // Positive core attracts; the negative outer annulus pushes points apart.
        const q=distance/particleRadius;
        const core=9*(1-smooth(.18,.52,q));
        const shell=7*smooth(.35,.58,q)*(1-smooth(.82,1.08,q));
        const force=(core-shell)*lensStrength;
        n.fx+=dx*force; n.fy+=dy*force;
        local.push(n);
      }
    }
    // Weak mutual attraction, with short-range separation so points never collapse.
    for(let i=0;i<local.length;i++)for(let j=i+1;j<local.length;j++){
      const a=local[i],b=local[j];
      const dx=(b.x-a.x)*innerWidth+b.ox-a.ox+(Math.sin(b.angle)*b.z-Math.sin(a.angle)*a.z)*.8;
      const dy=(b.y-a.y)*innerHeight+b.oy-a.oy+(Math.sin(b.angle*.65)*b.z-Math.sin(a.angle*.65)*a.z)*.4;
      const d=Math.hypot(dx,dy);if(d<.01||d>48)continue;
      const gap=(a.size+b.size)*1.35+8;
      const force=d<gap?(d-gap)*25:(d-gap)*2.1*(1-d/48);
      const fx=dx/d*force,fy=dy/d*force;
      a.fx+=fx;a.fy+=fy;b.fx-=fx;b.fy-=fy;
    }
    for(const n of nodes) {
      n.vx=(n.vx+n.fx*h)*Math.exp(-10*h);n.vy=(n.vy+n.fy*h)*Math.exp(-10*h);
      n.ox+=n.vx*h;n.oy+=n.vy*h;
      const bx=n.x*innerWidth,by=n.y*innerHeight,dx=cur.x-bx,dy=cur.y-by;
      const distance=Math.hypot(dx,dy);
      const edge=particleRadius*(.88+n.y*.12);
      const reveal=lensStrength*Math.max(0,Math.min(1,(edge-distance)/12));
      n.angle=damp(n.angle,reveal>0?dx/particleRadius*2.2+Math.sin(time*.8+n.x*12)*.14:0,4.5,dt);
      n.sx=bx+n.ox+Math.sin(n.angle)*n.z*.8;
      n.sy=by+n.oy+Math.sin(n.angle*.65)*n.z*.4;
      n.pz=n.z*Math.cos(n.angle);
      const facing=.6+.4*(.5+.5*Math.cos(n.angle+n.y*2));
      n.alpha=damp(n.alpha,reveal*facing,7,dt);
      if(n.alpha>.015)visible.push(n);
    }
    lensCtx.save();
    lensCtx.lineWidth=1.2;
    lensCtx.lineCap="round";
    const distance=(a:typeof nodes[number],b:typeof nodes[number])=>Math.hypot(a.sx-b.sx,a.sy-b.sy,(a.pz-b.pz)*.4);
    const degrees=new Map<number,number>();
    const selected=new Set<string>();
    const maxLinks=Math.min(4,Math.floor(visible.length/5));
    const claim=(key:string,a:typeof nodes[number],b:typeof nodes[number])=>{
      if(selected.has(key)||selected.size>=maxLinks||(degrees.get(a.id)||0)>=2||(degrees.get(b.id)||0)>=2)return;
      selected.add(key);degrees.set(a.id,(degrees.get(a.id)||0)+1);degrees.set(b.id,(degrees.get(b.id)||0)+1);
      if(!bonds.has(key))bonds.set(key,{a,b,alpha:0});
    };
    // Connect below 28px, release above 40px. Hysteresis avoids noisy flicker.
    for(const [key,bond] of bonds){
      if(bond.a.alpha>.12&&bond.b.alpha>.12&&distance(bond.a,bond.b)<40)claim(key,bond.a,bond.b);
    }
    const candidates:{a:typeof nodes[number];b:typeof nodes[number];d:number}[]=[];
    for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){
      const a=visible[i],b=visible[j],d=distance(a,b);
      if(d<28&&d>a.size+b.size+3&&Math.min(a.alpha,b.alpha)>.15)candidates.push({a,b,d});
    }
    candidates.sort((a,b)=>a.d-b.d);
    for(const {a,b} of candidates)claim(a.id+":"+b.id,a,b);
    for(const [key,bond] of bonds){
      const {a,b}=bond,d=distance(a,b);
      bond.alpha=damp(bond.alpha,selected.has(key)?1:0,10,dt);
      if(bond.alpha<.01&&!selected.has(key)){bonds.delete(key);continue;}
      if(d>=40)continue;
      const alpha=Math.min(a.alpha,b.alpha)*bond.alpha*.72;
      lensCtx.strokeStyle=`rgba(225,235,246,${alpha})`;
      lensCtx.beginPath();lensCtx.moveTo(a.sx,a.sy);lensCtx.lineTo(b.sx,b.sy);lensCtx.stroke();
    }
    for(const a of visible){
      lensCtx.fillStyle=`rgba(245,250,255,${Math.min(1,a.alpha*1.7)})`;
      lensCtx.beginPath();lensCtx.arc(a.sx,a.sy,a.size*(.85+Math.sin(a.angle)*.25),0,Math.PI*2);lensCtx.fill();
    }
    lensCtx.restore();
    // Moving bright segments run along the letter contours inside a crisp circular aperture.
    for(const el of headSpans) {
      if(!el.hasAttribute("data-lens") || !el.closest(".ch")?.classList.contains("is-on"))continue;
      const strength=Number(el.dataset.lensAlpha || 0);
      if(strength<.01)continue;
      const rect=el.getBoundingClientRect();
      const style=getComputedStyle(el);
      lensCtx.save();
      lensCtx.beginPath();lensCtx.arc(cur.x,cur.y,textRadius,0,Math.PI*2);lensCtx.clip();
      lensCtx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      lensCtx.letterSpacing=style.letterSpacing;
      const baseline=baselines.get(el)?.getBoundingClientRect().top ?? rect.bottom;
      const text=(el.dataset.t || el.textContent || "").toUpperCase();
      const scale=parseFloat(style.fontSize)/headingOutlines.units;
      lensCtx.strokeStyle=`rgba(245,248,255,${strength*.95})`;
      for(let i=0;i<text.length;i++) {
        const contours=glyphContours.get(text[i]);if(!contours)continue;
        const x=rect.left+lensCtx.measureText(text.slice(0,i+1)).width-lensCtx.measureText(text[i]).width;
        lensCtx.save();lensCtx.translate(x,baseline);lensCtx.scale(scale,-scale);
        lensCtx.lineWidth=1.65/scale;
        for(const contour of contours){
          // Exactly two illuminated segments per closed contour.
          lensCtx.setLineDash([contour.length*.28,contour.length*.22]);
          lensCtx.lineDashOffset=-time*contour.length*.11;
          lensCtx.stroke(contour.path);
        }
        lensCtx.restore();
      }
      lensCtx.restore();
    }
  }
  const headSpans = $$<HTMLElement>(".ln > span");
  for(const el of headSpans){
    const marker=document.createElement("i");
    marker.setAttribute("aria-hidden","true");
    marker.style.cssText="display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline";
    el.append(marker);baselines.set(el,marker);
  }
  window.addEventListener("pointermove", e => { if(e.pointerType !== "touch")pointerPresent=true; });
  document.documentElement.addEventListener("pointerleave", () => {pointerPresent=false;});
  function updateLensHit() {
    lensOn=false;
    lensTarget=0;
    const enabled=pointerPresent && root.classList.contains("is-interactive") && !root.classList.contains("is-menu") && !document.querySelector(".muscle-orbit[open]");
    for(const el of headSpans){
      const on=enabled && el.closest(".ch")!.classList.contains("is-on");
      let proximity=0;
      if(on && el.firstChild){
        const range=document.createRange();range.selectNode(el.firstChild);
        const r=range.getBoundingClientRect();
        const radius=Math.max(60,Math.min(112,parseFloat(getComputedStyle(el).fontSize)*.60));
        // Use the rendered lens position, not the faster raw pointer. Keep it alive
        // while its aperture overlaps text, including the space between lines.
        const dx=Math.max(r.left-cur.x,0,cur.x-r.right);
        const dy=Math.max(r.top-cur.y,0,cur.y-r.bottom);
        proximity=1-smooth(radius*.15,radius,Math.hypot(dx,dy));
      }
      el.dataset.lensTarget=String(proximity);
      lensTarget=Math.max(lensTarget,proximity);
      if(proximity>0){
        lensOn=true;el.setAttribute("data-lens","");
        textRadius=Math.max(60,Math.min(112,parseFloat(getComputedStyle(el).fontSize)*.60));
        el.style.setProperty("--lens-radius",textRadius+"px");
      }
    }
  }

  // ---- Copy belongs to the scroll. A chapter's text comes in over the first ENTER of its span and leaves over
  // the last EXIT, as a function of position: scroll back and it undoes itself. Headlines are first traced
  // (each letter's outline drawn round from the font's own contours), then filled inside that outline from the
  // baseline up. Only the opening headline runs on time, because the page has not been scrolled yet.
  const EXIT = 0.16;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const copy = chEls.map(({ el, span }) => ({
    el,
    span,
    lines: Array.from(el.querySelectorAll<HTMLElement>(".ln > span")).map((line) => ({ line, trace: 1, fill: 1 })),
    e: 0,
    x: 0,
    on: false,
  }));
  let heroLiveAt: number | null = null;
  function traceHeadlines() {
    for (const c of copy) {
      if (!c.on || c.x >= 1) continue;
      for (const { line, trace, fill } of c.lines) {
        if (trace <= 0 || fill >= 1) continue;
        const alpha = (1 - smooth(0.95, 1, fill)) * (1 - c.x);
        const rect = line.getBoundingClientRect();
        const style = getComputedStyle(line);
        lensCtx.save();
        lensCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        lensCtx.letterSpacing = style.letterSpacing;
        const baseline = baselines.get(line)?.getBoundingClientRect().top ?? rect.bottom;
        const text = (line.dataset.t || line.textContent || "").toUpperCase();
        const scale = parseFloat(style.fontSize) / headingOutlines.units;
        for (let i = 0; i < text.length; i += 1) {
          const contours = glyphContours.get(text[i]);
          if (!contours) continue;
          const along = i / Math.max(1, text.length - 1);
          // Letters start one after another, left to right, like a hand writing the line.
          const t = clamp(trace * 1.7 - along * 0.7);
          if (t <= 0) continue;
          const x = rect.left + lensCtx.measureText(text.slice(0, i + 1)).width - lensCtx.measureText(text[i]).width;
          lensCtx.save();
          lensCtx.translate(x, baseline);
          lensCtx.scale(scale, -scale);
          // Fill: the traced line thickens inward from every edge of the letter until the strokes meet in the
          // middle. It is the same contour drawn wider and clipped to the glyph, so it can only grow inside.
          const f = clamp(fill * 1.5 - along * 0.5);
          if (f > 0) {
            lensCtx.save();
            lensCtx.clip(glyphShapes.get(text[i])!);
            lensCtx.setLineDash([]);
            lensCtx.lineJoin = "round";
            lensCtx.lineWidth = f * f * (3 - 2 * f) * 230; // font units; a bold stem is about 150 wide
            lensCtx.strokeStyle = `rgba(233,236,242,${alpha.toFixed(3)})`;
            for (const contour of contours) lensCtx.stroke(contour.path);
            lensCtx.restore();
          }
          for (const contour of contours) {
            lensCtx.lineWidth = 1.25 / scale;
            lensCtx.strokeStyle = `rgba(233,236,242,${(alpha * 0.92).toFixed(3)})`;
            lensCtx.setLineDash([contour.length * t, contour.length * 1.02]);
            lensCtx.lineDashOffset = 0;
            lensCtx.stroke(contour.path);
            if (t < 1) {
              // The pen: a short bright stretch at the head of the stroke.
              const tip = Math.min(contour.length * t, contour.length * 0.06);
              lensCtx.lineWidth = 2.4 / scale;
              lensCtx.strokeStyle = `rgba(196,170,255,${alpha.toFixed(3)})`;
              lensCtx.setLineDash([tip, contour.length * 2]);
              lensCtx.lineDashOffset = -(contour.length * t - tip);
              lensCtx.stroke(contour.path);
            }
          }
          lensCtx.restore();
        }
        lensCtx.restore();
      }
    }
  }

  // ---- Coming to rest between chapters (snap.ts). Rest points and the scene hold around them live in stage.ts.
  const probe = import.meta.env.DEV ? ((window as unknown as Record<string, unknown>).__xpSnap = {
    points: () => RESTS.map((r) => Math.round(r * pixelsPerUnit())),
    log: [] as string[],
  }) as { log: string[] } : null;
  if (!new URLSearchParams(location.search).has("still")) {
    snap = createSnap({
      stops: () => RESTS.map((r) => r * pixelsPerUnit()),
      blocked: () => !started || stage.reduced || timelineDragging || root.classList.contains("is-menu") || !!document.querySelector(".muscle-orbit[open]"),
      log: probe ? (line) => probe.log.push(line) : undefined,
    });
  }

  const skipRender = import.meta.env.DEV && new URLSearchParams(location.search).has("norender");
  const lastFront = 0;
  // ---- Loop.
  let u = window.scrollY / pixelsPerUnit();
  let prev = performance.now();
  let lastU = u;
  function tick(now: number) {
    const dt = Math.max(0.001, Math.min(0.05, (now - prev) / 1000)) || 0.016;
    prev = now;
    const target = Math.min(TOTAL - 0.001, Math.max(0, window.scrollY / pixelsPerUnit()));
    u = stage.reduced || timelineDragging ? target : damp(u, target, 8, dt);
    if (Math.abs(u - target) < 0.0005) u = target;
    const velocity = (u - lastU) / dt;
    lastU = u;

    // Dev-only: `?norender` skips WebGL so scroll tests run at real event rates in a software-rendered browser.
    // The scene runs on held time (still around each rest point); copy below runs on the raw position.
    const front = import.meta.env.DEV && skipRender ? lastFront : stage.frame(sceneTime(u), now / 1000, dt, velocity);
    root.dataset.act = String(front);
    $(".glasses-controls").inert=front!==4 || root.classList.contains("is-menu");
    const activeChapter=spans.find(s=>u>=s.start && u<s.end);
    for(const {el,input,label} of timelines){
      el.inert=Number(el.dataset.timeline)!==front || root.classList.contains("is-menu");
      if(!timelineDragging) input.value=String(u);
      const progress=Math.max(0,Math.min(1,(u-Number(input.min))/(Number(input.max)-Number(input.min))));
      input.style.setProperty("--progress", `${progress*100}%`);
      label.textContent=activeChapter?chapterLabels[activeChapter.id]:"";
      input.setAttribute("aria-valuetext",label.textContent);
    }
    subchapterButtons.forEach(el=>el.setAttribute("aria-current",String(el.dataset.subchapter===activeChapter?.id)));

    if (heroLiveAt === null && root.classList.contains("is-live")) heroLiveAt = now;
    for (const c of copy) {
      const { el, span } = c;
      const last = span.end >= TOTAL;
      const on = u >= span.start && (u < span.end || last);
      c.on = on;
      if (on !== el.classList.contains("is-on")) {
        el.classList.toggle("is-on", on);
        el.toggleAttribute("inert", !on);
      }
      if (!on) continue;
      const e = stage.reduced ? 1 : span.start === 0 ? (heroLiveAt === null ? 0 : clamp((now - heroLiveAt) / 1500)) : clamp((u - span.start) / ENTER);
      const x = last || stage.reduced ? 0 : clamp((u - (span.end - EXIT)) / EXIT);
      c.e = e;
      c.x = x;
      el.style.setProperty("--c", ((u - span.start) / (span.end - span.start)).toFixed(3));
      el.style.setProperty("--e", e.toFixed(3));
      el.style.setProperty("--x", x.toFixed(3));
      const stagger = Math.min(0.08, 0.2 / Math.max(1, c.lines.length));
      c.lines.forEach((l, i) => {
        l.trace = clamp((e - i * stagger) / 0.5);
        l.fill = clamp((e - 0.42 - i * stagger) / 0.38);
        l.line.style.setProperty("--f", l.fill.toFixed(3));
      });
    }
    for (const r of railEls) {
      const on = u >= r.start && u < r.end;
      r.el.classList.toggle("is-on", on);
      r.arc.style.strokeDashoffset = String(1 - Math.min(1, Math.max(0, (u - r.start) / (r.end - r.start))));
    }
    const active = spans.find((s) => u >= s.start && u < s.end)?.id;
    for (const h of hots) h.classList.toggle("is-on", h.dataset.hot === active);
    root.classList.toggle("is-top", u < 0.25);
    const scrubbing = active === "find";
    if (scrubbing !== root.classList.contains("is-scrub")) {
      root.classList.toggle("is-scrub", scrubbing);
      hudBar.tabIndex = scrubbing ? 0 : -1;
      if (!scrubbing) scrub = null;
    }
    updateLensHit();
    if (!stage.reduced) {
      drawLens(now / 1000, dt);
      traceHeadlines();
    }
    for (const el of headSpans) {
      if (!el.hasAttribute("data-lens")) continue;
      const strength = damp(Number(el.dataset.lensAlpha || 0), Number(el.dataset.lensTarget || 0), 4, dt);
      el.dataset.lensAlpha = String(strength);
      el.style.setProperty("--lens-strength",strength.toFixed(3));
      if(strength < .005 && Number(el.dataset.lensTarget || 0) === 0) {el.removeAttribute("data-lens");continue;}
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${(cur.x - r.left).toFixed(1)}px`);
      el.style.setProperty("--my", `${(cur.y - r.top).toFixed(1)}px`);
    }

    // The cursor ring trails the pointer slowly and settles without overshoot.
    const ch = Math.min(dt, 0.033);
    cur.vx += ((cur.tx - cur.x) * 36 - cur.vx * 13) * ch;
    cur.vy += ((cur.ty - cur.y) * 36 - cur.vy * 13) * ch;
    cur.x += cur.vx * ch;
    cur.y += cur.vy * ch;
    cursor.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`;

    if (!started) {
      const elapsed = now - loadingStartedAt;
      // A short paced presentation, capped below completion until Origin is ready.
      const progress = Math.min(94, 94 * (1 - Math.exp(-elapsed / 500)));
      loaderFill.style.width = `${progress}%`;
      loaderTrack.setAttribute("aria-valuenow", String(Math.round(progress)));
      if (homeReady && (stage.reduced || elapsed >= 1400)) {
        started = true;
        loaderFill.style.width = "100%";
        loaderTrack.setAttribute("aria-valuenow", "100");
        root.classList.add("is-ready");
        entranceStartedAt = performance.now() + (stage.reduced ? 0 : 150);
        setTimeout(() => loader.remove(), stage.reduced ? 0 : 600);
        setTimeout(() => root.classList.add("is-live"), stage.reduced ? 0 : 450);
        // Enable the pointer only after the title and opening turn have settled.
        setTimeout(() => root.classList.add("is-interactive"), stage.reduced ? 0 : 1050);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
