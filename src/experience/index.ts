import "@fontsource-variable/space-grotesk";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./experience.css";
import { benchmark, chapters, glassesParts } from "./data";
import { asset, page } from "./paths";
import { type Act, TOTAL, createStage, damp, spans } from "./stage";
import { createOrigin } from "./acts/origin";
import { type SwingData, createSwing } from "./acts/swing";
import { createBenchmark } from "./acts/benchmark";
import { createSki, skiPeak } from "./acts/ski";
import { createGlasses } from "./acts/glasses";
import { createField } from "./acts/field";

const lines = (...text: string[]) => text.map((t, i) => `<span class="ln" style="--i:${i}"><span data-t="${t}">${t}</span></span>`).join("");
const orb = (label: string, href: string, extra = "") =>
  `<a class="orb" href="${href}" ${extra} data-cursor><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="58"/><circle class="orb__arc" cx="60" cy="60" r="58"/></svg><span>${label}</span></a>`;

const findingIds = ["sway", "trail-knee", "lead-arm", "hang-back"];
const groups = [...new Set(chapters.map((c) => c.group))];
const groupSpan = (g: string) => {
  const mine = spans.filter((s) => s.group === g);
  return { start: mine[0].start, end: mine[mine.length - 1].end };
};

function markup() {
  const seq = benchmark["32"];
  const peak = skiPeak();
  return /* html */ `
  <canvas class="xp-canvas" aria-hidden="true"></canvas>
  <div class="xp-grid" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b><b></b></div>

  <header class="xp-top">
    <button class="xp-burger" type="button" aria-label="Open menu" aria-expanded="false" data-cursor><i></i><i></i></button>
    <a class="xp-mark" href="#hero" data-jump="0" aria-label="Cerebel AI"><img src="${asset("/assets/cerebel-wordmark.png")}" alt="Cerebel" width="595" height="194"></a>
    <nav class="xp-top__links" aria-label="Shortcuts">
      <a href="${page("/playground")}" data-cursor>Playground ↗</a>
      <a class="xp-pill" href="mailto:hello@cerebel.tech?subject=Demo%20request" data-cursor>Request a demo</a>
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
      <p class="row"><a class="xp-pill" href="${page("/playground")}" data-cursor>Analyse your swing</a><span class="fine">Free covers three swings a month.</span></p>
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
      <p>We have not published a snowboard capture yet. This is a carved turn modelled from two inputs, ${peak.kmh.toFixed(0)} km/h and an ${peak.radius.toFixed(0)} m arc, to show what the analysis reads on snow.</p>
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

    <section class="ch ch--field" data-ch="field">
      <h2>${lines("Already", "in the field.")}</h2>
      <ul class="partners">
        <li><a href="https://apocynthion.ai/" target="_blank" rel="noreferrer" data-cursor><b>Apocynthion</b><span>Humanoid partnership. Its ArenaLabs line builds AlphaMotion, described on its site as the cerebellum for humanoid robots.</span><i>↗</i></a></li>
        <li><a href="${page("/playground")}" data-cursor><b>Athletic coaching</b><span>Ski, golf and tennis: edge, rotation, contact.</span><i>↗</i></a></li>
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

  <div class="xp-anchors" aria-hidden="true">
    ${seq.map((row, i) => `<div class="tag tag--bar${i === 0 ? " is-lead" : ""}" data-anchor="bar-${i}"><b>${row[0]}</b><span class="num" data-bar="${i}">0.0</span></div>`).join("")}
    ${[0, 20, 40, 60, 80].map((mm) => `<div class="tag tag--tick num" data-anchor="tick-${mm}">${mm}</div>`).join("")}
    <div class="tag tag--gap" data-anchor="gap"><span class="num" data-bench="gap"></span><em>mm between them</em></div>
    <div class="tag tag--ski" data-anchor="ski-force"><b class="num"><span data-ski="load2">1.0</span>×</b><span>ground reaction</span></div>
    <div class="joint" data-anchor="joint"><i></i><div><b class="num" data-joint="value"></b><span data-joint="caption"></span></div></div>
    <div class="tag tag--fig" data-anchor="fig-surface">Body surface</div>
    <div class="tag tag--fig" data-anchor="fig-skeleton">Skeleton + muscles</div>
    ${glassesParts.map((p) => `<div class="hot" data-anchor="h-${p.id.slice(2)}" data-hot="${p.id}"><i></i><span><b class="num">${p.n}</b>${p.title}</span></div>`).join("")}
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

  <div class="xp-hint" aria-hidden="true"><span>Scroll to discover</span><i></i></div>

  <div class="xp-menu" aria-hidden="true">
    <p class="fine">Explore the story</p>
    <ol>${groups.map((g, i) => `<li><button type="button" data-group="${g}" data-cursor><em>Chapter ${i + 1}</em>${g}</button></li>`).join("")}</ol>
    <div class="xp-menu__side">
      <a href="mailto:hello@cerebel.tech?subject=Demo%20request" data-cursor>Request a demo</a>
      <a href="${page("/playground")}" data-cursor>Playground ↗</a>
      <a href="${page("/")}" data-cursor>Previous site</a>
    </div>
  </div>

  <div class="xp-loader" role="status"><img src="${asset("/assets/cerebel-wordmark.png")}" alt="Cerebel" width="595" height="194"><b class="num">0%</b><span>Loading the experience.</span></div>
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

  let vh = window.innerHeight;
  let vw = window.innerWidth;
  const layout = () => {
    // Ignore mobile address-bar height changes so the scroll map does not jump.
    if (window.innerWidth !== vw || Math.abs(window.innerHeight - vh) > 120) {
      vw = window.innerWidth;
      vh = window.innerHeight;
    }
    spacer.style.height = `${(TOTAL + 0.62) * vh}px`;
  };
  layout();
  window.addEventListener("resize", layout);
  const jump = (units: number) => window.scrollTo({ top: units * vh + 2, behavior: stage.reduced ? "auto" : "smooth" });

  // ---- Swing: copy and traces come from the capture's own analysis file.
  let swing: SwingData | null = null;
  const traceDots: { el: SVGCircleElement; values: number[]; min: number; max: number }[] = [];
  const W = 300;
  const H = 70;
  function fillSwing(d: SwingData) {
    swing = d;
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
  function showSki(v: { kmh: number; radius: number; lean: number; load: number }) {
    const load = v.load.toFixed(1);
    skiEls.load.textContent = skiEls.load2.textContent = skiEls.load3.textContent = load;
    skiEls.lean.textContent = skiEls.lean2.textContent = v.lean.toFixed(0);
    skiEls.kmh.textContent = v.kmh.toFixed(0);
    skiEls.radius.textContent = Number.isFinite(v.radius) && v.radius < 400 ? v.radius.toFixed(0) : "–";
  }

  const acts: Act[] = [
    createOrigin(),
    createSwing(fillSwing, showFrame, () => scrub),
    createSki(showSki),
    createBenchmark(() => seqKey, showBench),
    createGlasses(),
    createField(),
  ];
  const stage = createStage($<HTMLCanvasElement>(".xp-canvas"), acts, $(".xp-anchors"));

  // ---- Loader.
  const loader = $(".xp-loader");
  const loaderNum = loader.querySelector("b")!;
  let loaded = 0;
  let shownPct = 0;
  acts.forEach((a) => a.ready.then(() => (loaded += 1), () => (loaded += 1)));
  let started = false;

  // ---- Chrome.
  const chEls = $$<HTMLElement>("[data-ch]").map((el) => ({ el, span: spans.find((s) => s.id === el.dataset.ch)! }));
  const railEls = $$<HTMLButtonElement>(".xp-rail [data-group]").map((el) => ({ el, arc: el.querySelector<SVGCircleElement>(".arc")!, ...groupSpan(el.dataset.group!) }));
  const hots = $$<HTMLElement>("[data-hot]");
  $$<HTMLElement>("[data-group]").forEach((el) => el.addEventListener("click", () => {
    setMenu(false);
    jump(groupSpan(el.dataset.group!).start);
  }));
  $$<HTMLElement>("[data-jump]").forEach((el) => el.addEventListener("click", (e) => {
    e.preventDefault();
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

  // ---- Headline lens: under the pointer the letters fall back to outlines and a small constellation shows.
  // The constellation is a small 3D cloud drawn live: it turns, breathes, and each node trails the pointer at its own pace.
  const lens = root.querySelector<HTMLCanvasElement>(".xp-lens")!;
  const lensCtx = lens.getContext("2d")!;
  const LN = 26;
  const nodes = Array.from({ length: LN }, (_, i) => {
    const a = i * 2.399963;
    const y = 1 - (2 * (i + 0.5)) / LN;
    const rad = Math.sqrt(1 - y * y) * (0.55 + 0.45 * ((i * 0.618) % 1));
    return { x: Math.cos(a) * rad, y: y * (0.55 + 0.45 * ((i * 0.382) % 1)), z: Math.sin(a) * rad, cx: -999, cy: -999, vx: 0, vy: 0, lag: 16 + (i % 7) * 6, size: 1.2 + ((i * 0.37) % 1) * 2.4, sx: 0, sy: 0, d: 0 };
  });
  let lensAlpha = 0;
  // Pointer speed shapes the cloud: it stretches along the motion, thins across it and spins faster.
  const lensVel = { x: 0, y: 0, px: 0, py: 0, spin: 0, squash: 0 };
  let lensOn = false;
  function sizeLens() {
    const k = Math.min(window.devicePixelRatio || 1, 2);
    lens.width = Math.round(window.innerWidth * k);
    lens.height = Math.round(window.innerHeight * k);
    lensCtx.setTransform(k, 0, 0, k, 0, 0);
  }
  sizeLens();
  window.addEventListener("resize", sizeLens);
  function drawLens(time: number, dt: number) {
    lensAlpha = damp(lensAlpha, lensOn ? 1 : 0, 7, dt);
    if (lensAlpha < 0.01) {
      if (lens.dataset.clear !== "1") {
        lensCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        lens.dataset.clear = "1";
        for (const n of nodes) {
          n.cx = n.cy = -999;
          n.vx = n.vy = 0;
        }
      }
      return;
    }
    lens.dataset.clear = "0";
    lensCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    lensVel.x = damp(lensVel.x, (cur.tx - lensVel.px) / Math.max(dt, 0.001), 8, dt);
    lensVel.y = damp(lensVel.y, (cur.ty - lensVel.py) / Math.max(dt, 0.001), 8, dt);
    lensVel.px = cur.tx;
    lensVel.py = cur.ty;
    const speed = Math.hypot(lensVel.x, lensVel.y);
    const pull = Math.min(1, speed / 1400);
    lensVel.squash = damp(lensVel.squash, pull, 5, dt);
    lensVel.spin += dt * (0.28 + lensVel.squash * 0.9);
    const ux = speed > 1 ? lensVel.x / speed : 1;
    const uy = speed > 1 ? lensVel.y / speed : 0;
    const ry = lensVel.spin;
    const rx = lensVel.spin * 0.61;
    const R = 78 * (1 + 0.06 * Math.sin(time * 1.7) + lensVel.squash * 0.08);
    for (const n of nodes) {
      if (n.cx < -900) {
        n.cx = cur.x;
        n.cy = cur.y;
      }
      // Each node drags behind the ring at its own slow pace and comes to rest without overshoot.
      const c = 2.2 * Math.sqrt(n.lag);
      const h = Math.min(dt, 0.033);
      n.vx += ((cur.x - n.cx) * n.lag - n.vx * c) * h;
      n.vy += ((cur.y - n.cy) * n.lag - n.vy * c) * h;
      n.cx += n.vx * h;
      n.cy += n.vy * h;
      // Rotate about y, then x; project with a little perspective.
      const x1 = n.x * Math.cos(ry) + n.z * Math.sin(ry);
      const z1 = -n.x * Math.sin(ry) + n.z * Math.cos(ry);
      const y1 = n.y * Math.cos(rx) - z1 * Math.sin(rx);
      const z2 = n.y * Math.sin(rx) + z1 * Math.cos(rx);
      const persp = 2.6 / (2.6 - z2);
      const ox = x1 * R * persp;
      const oy = y1 * R * persp;
      const along = (ox * ux + oy * uy) * (1 + 0.45 * lensVel.squash);
      const across = (-ox * uy + oy * ux) * (1 - 0.15 * lensVel.squash);
      n.sx = n.cx + along * ux - across * uy;
      n.sy = n.cy + along * uy + across * ux;
      n.d = persp;
    }
    lensCtx.lineWidth = 0.8;
    for (let i = 0; i < LN; i += 1) {
      for (let j = i + 1; j < LN; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const d3 = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        if (d3 > 0.62) continue;
        lensCtx.strokeStyle = `rgba(233,236,242,${(lensAlpha * 0.55 * (1 - d3 / 0.62) * Math.min(a.d, b.d)).toFixed(3)})`;
        lensCtx.beginPath();
        lensCtx.moveTo(a.sx, a.sy);
        lensCtx.lineTo(b.sx, b.sy);
        lensCtx.stroke();
      }
    }
    for (const n of nodes) {
      lensCtx.fillStyle = `rgba(255,255,255,${(lensAlpha * Math.min(1, 0.35 + (n.d - 0.7) * 1.1)).toFixed(3)})`;
      lensCtx.beginPath();
      lensCtx.arc(n.sx, n.sy, n.size * n.d, 0, 6.283);
      lensCtx.fill();
    }
  }
  const headSpans = $$<HTMLElement>(".ln > span");
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    let hit = false;
    for (const el of headSpans) {
      const on = el.closest(".ch")!.classList.contains("is-on");
      const r = on ? el.getBoundingClientRect() : null;
      const inside = !!r && e.clientX > r.left - 80 && e.clientX < r.right + 80 && e.clientY > r.top - 80 && e.clientY < r.bottom + 80;
      if (inside && r) {
        el.setAttribute("data-lens", "");
        hit = hit || (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom);
      } else if (el.hasAttribute("data-lens")) el.removeAttribute("data-lens");
    }
    lensOn = hit;
  });
  document.documentElement.addEventListener("pointerleave", () => {
    lensOn = false;
    for (const el of headSpans) el.removeAttribute("data-lens");
  });

  // ---- Loop.
  let u = window.scrollY / vh;
  let prev = performance.now();
  let lastU = u;
  function tick(now: number) {
    const dt = Math.min(0.05, (now - prev) / 1000) || 0.016;
    prev = now;
    const target = Math.min(TOTAL - 0.001, Math.max(0, window.scrollY / vh));
    u = stage.reduced ? target : damp(u, target, 7, dt);
    if (Math.abs(u - target) < 0.0005) u = target;
    const velocity = (u - lastU) / dt;
    lastU = u;

    const front = stage.frame(u, now / 1000, dt, velocity);
    root.dataset.act = String(front);

    for (const { el, span } of chEls) {
      const on = u >= span.start && (u < span.end || span.end >= TOTAL);
      if (on !== el.classList.contains("is-on")) {
        el.classList.toggle("is-on", on);
        el.toggleAttribute("inert", !on);
      }
      if (on) el.style.setProperty("--c", ((u - span.start) / (span.end - span.start)).toFixed(3));
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
    if (!stage.reduced) drawLens(now / 1000, dt);
    for (const el of headSpans) {
      if (!el.hasAttribute("data-lens")) continue;
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
      const pct = (loaded / acts.length) * 100;
      shownPct = Math.min(pct, shownPct + dt * 160);
      loaderNum.textContent = `${Math.round(shownPct)}%`;
      if (shownPct >= 100) {
        started = true;
        root.classList.add("is-ready");
        setTimeout(() => loader.remove(), 1200);
        // The subject holds the screen alone for a beat before any interface arrives.
        // The subject holds the screen alone for a beat before any interface arrives.
        setTimeout(() => root.classList.add("is-live"), stage.reduced ? 0 : 1900);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
