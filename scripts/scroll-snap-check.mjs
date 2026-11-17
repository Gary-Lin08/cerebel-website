// Drives the experience with trackpad-like and wheel-like input in a real (headless) Chrome and reports where the
// page comes to rest. Needs the dev server (the probe `window.__xpSnap` only exists in dev builds).
//
//   node scripts/scroll-snap-check.mjs [url] [seed]
//
// A trackpad gesture is modelled as a finger phase (steady small deltas) followed by momentum (deltas decaying
// each frame down to 1 px), which is how macOS delivers them. A page is "at rest" when nothing has moved it for
// 2.5 s; it should then sit on a reading point (or the very bottom).
import { chromium } from "@playwright/test";

const url = process.argv[2] || "http://localhost:5173/experience.html?norender";
let seed = Number(process.argv[3] || 7);
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector(".xp.is-live", { timeout: 90000 });
await page.mouse.move(720, 450);
await page.waitForTimeout(3000);

const points = await page.evaluate(() => window.__xpSnap.points());
console.log("stops", points.join(" "));
const bottom = await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
const y = () => page.evaluate(() => Math.round(scrollY));
const takeLog = () => page.evaluate(() => window.__xpSnap.log.splice(0));
const nearest = (v) => [...points, bottom].reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

async function trackpad(dir, fingerPx, release, { frames = 10 } = {}) {
  for (let i = 0; i < frames; i += 1) {
    await page.mouse.wheel(0, (dir * fingerPx) / frames);
    await page.waitForTimeout(16);
  }
  for (let v = release; v >= 1; v *= 0.94) {
    await page.mouse.wheel(0, dir * Math.max(1, Math.round(v)));
    await page.waitForTimeout(16);
  }
}
async function wheelNotches(dir, n) {
  for (let i = 0; i < n; i += 1) {
    await page.mouse.wheel(0, dir * 100);
    await page.waitForTimeout(90);
  }
}
async function waitRest(ms = 2600) {
  let last = await y();
  let still = 0;
  for (let t = 0; t < 9000 && still < ms; t += 100) {
    await page.waitForTimeout(100);
    const now = await y();
    still = now === last ? still + 100 : 0;
    last = now;
  }
  return last;
}

const results = [];
async function trial(name, gesture, expected) {
  const from = await y();
  await gesture();
  const released = await y();
  const rest = await waitRest();
  const target = nearest(rest);
  const off = rest - target;
  const log = await takeLog();
  const r = { name, from, released, rest, off, ok: Math.abs(off) <= 3 && (expected === undefined || Math.abs(rest - expected) <= 3), log };
  if (expected !== undefined) r.name += ` -> ${expected === rest ? "expected stop" : "WRONG stop (wanted " + expected + ")"}`;
  results.push(r);
  console.log(`${r.ok ? "ok  " : "MISS"} ${r.name.padEnd(28)} from ${String(r.from).padStart(6)} released ${String(r.released).padStart(6)} rest ${String(r.rest).padStart(6)} off ${String(r.off).padStart(5)}  | ${r.log.join(" ; ")}`);
}

// 1. Random trackpad flicks of every size, both directions, across the whole page.
for (let k = 0; k < Number(process.env.FLICKS || 10); k += 1) {
  const dir = rand() < 0.62 ? 1 : -1;
  const finger = 40 + rand() * 500;
  const release = 2 + rand() * 30;
  await trial(`flick ${dir > 0 ? "down" : "up"} ${Math.round(finger)}/${release.toFixed(0)}`, () => trackpad(dir, finger, release));
}
// 2. Controlled releases: from stop i, move a fraction of the way to the next (or previous) stop, let go, and
// check which stop the page settles on. Expected rule: committed once 30% of the way in the direction of travel.
const fracs = (process.env.FRACS || "0.2,0.35,0.5,0.7").split(",").map(Number);
const starts = (process.env.STARTS || "3,9,12,13").split(",").map(Number); // 12 -> 13 crosses into Benchmark
for (const i of starts) {
  for (const f of fracs) {
    for (const dir of [1, -1]) {
      const j = i + dir;
      if (j < 0 || j >= points.length) continue;
      await page.evaluate((v) => scrollTo(0, v), points[i]);
      await waitRest(1200);
      await takeLog();
      const want = f >= 0.3 ? points[j] : points[i];
      const total = Math.abs(points[j] - points[i]) * f;
      await trial(`stop ${i} ${dir > 0 ? "down" : "up"} ${Math.round(f * 100)}%`, async () => {
        // finger-only drag: 18 px events at frame rate, no momentum
        for (let moved = 0; moved < total; moved += 18) {
          await page.mouse.wheel(0, dir * Math.min(18, total - moved));
          await page.waitForTimeout(16);
        }
      }, want);
    }
  }
}
// 3. Scroll again while a glide is running: the glide must give way at once, and the page must still come to rest.
for (let k = 0; k < Number(process.env.RESCROLLS || 3); k += 1) {
  await trial(`re-scroll during glide ${k}`, async () => {
    await trackpad(1, 900, 6);
    await page.waitForTimeout(320 + rand() * 250);
    const before = await y();
    await trackpad(k % 2 ? -1 : 1, 300, 6);
    const after = await y();
    const log = await page.evaluate(() => window.__xpSnap.log.slice(-40).join(" ; "));
    console.log(`     mid-glide check: moved ${after - before}px under the second gesture; yielded: ${log.includes("yield")}`);
  });
}
// 4b. Momentum tail during a glide: 1 px events must not stop it.
await trial("1px tail during glide", async () => {
  await trackpad(1, 700, 4);
  await page.waitForTimeout(260);
  for (let k = 0; k < 12; k += 1) {
    await page.mouse.wheel(0, 1);
    await page.waitForTimeout(30);
  }
});
// 4. Mouse wheel notches.
for (let k = 0; k < Number(process.env.WHEELS || 3); k += 1) await trial(`wheel ${k % 2 ? "up" : "down"} x${1 + (k % 3)}`, () => wheelNotches(k % 2 ? -1 : 1, 1 + (k % 3)));

const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length} of ${results.length} trials came to rest on a reading point`);
console.log(errors.length ? errors : "no page errors");
await browser.close();
