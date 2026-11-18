// Coming to rest. When the reader lets go between two rest points, the page glides softly to one of them.
//
// The rules, in full:
//   1. Never move the page while the reader is moving it. Any real input (wheel, touch, keys, a press) cancels a
//      glide at once. The last 1–2 px events of a trackpad's momentum do not count as new input.
//   2. "Let go" means no input for QUIET_FRAMES rendered frames and at least QUIET_MS. Counting frames as well as
//      time means one long frame (the page draws two scenes during a change) cannot pass for a pause.
//   3. Where to go: the rest point the reader was heading for, once they have covered COMMIT of the way to it;
//      otherwise back to the one they came from. With no direction known, the nearest.
//   4. If something is in the way (menu open, a drag in progress, the scene not started), wait and try again when
//      it clears. A pending rest is never dropped.
//
// Rest points come from stage.ts (RESTS); the scene is held still around each one, so the picture at rest is
// always settled.

const QUIET_MS = 105;
const QUIET_FRAMES = 4;
const COMMIT = 0.3;
const MOMENTUM_TAIL_PX = 2; // wheel deltas this small after a gesture are the tail of its momentum

type Options = {
  /** Rest points in page pixels, ascending. Read every time so a resize is picked up. */
  stops: () => number[];
  freeScroll: (y: number) => boolean;
  coastLimits: () => number[];
  commitDistance: (from: number, gap: number) => number;
  /** True while something else owns the page (menu, drag, reduced motion, not started). */
  blocked: () => boolean;
  log?: (line: string) => void;
};

export function createSnap({ stops, freeScroll, coastLimits, commitDistance, blocked, log }: Options) {
  const root = document.scrollingElement || document.documentElement;
  const maxScroll = () => root.scrollHeight - root.clientHeight;

  let pending = false; // the reader has moved the page and it has not been brought to rest yet
  let lastInput = 0;
  let framesSinceInput = 0;
  let direction = 0; // +1 down, -1 up, 0 unknown
  let origin = window.scrollY; // where the current gesture started
  let held = false; // a finger or button is down
  let glide: { from: number; to: number; start: number; duration: number; lastSet: number; coast?: boolean } | null = null;
  let frame = 0;
  let wheelSpeed = 0; // CSS pixels per millisecond

  const input = (dir = 0) => {
    if (glide) {
      log?.(`yield ${Math.round(window.scrollY)}`);
      glide = null;
    }
    if (!pending) origin = window.scrollY;
    if (dir) direction = dir;
    pending = true;
    lastInput = performance.now();
    framesSinceInput = 0;
    wake();
  };

  function target(y: number) {
    const points = [...stops(), maxScroll()].filter((p) => p <= maxScroll()).sort((a, b) => a - b);
    let below = points[0];
    let above = points[points.length - 1];
    for (const p of points) {
      if (p <= y) below = p;
      if (p >= y) {
        above = p;
        break;
      }
    }
    if (above === below) return above;
    const progress = (y - below) / (above - below);
    // Heading for a stop: commit once COMMIT of the way there. Use the gesture's own direction, not just the
    // last event, so a reader who overshoots and pulls back is read correctly.
    const heading = Math.sign(y - origin) || direction;
    if (heading > 0) return y - below >= Math.min((above - below) * COMMIT, commitDistance(below, above - below)) ? above : below;
    if (heading < 0) return above - y >= Math.min((above - below) * COMMIT, commitDistance(above, above - below)) ? below : above;
    return progress < 0.5 ? below : above;
  }

  function startGlide() {
    const y = window.scrollY;
    pending = false;
    if (freeScroll(y)) {
      const [first, last] = coastLimits();
      const limit = Math.min((last - first) * 0.12, window.innerHeight * 0.32);
      const travel = Math.max(-limit, Math.min(limit, wheelSpeed * 200));
      const to = Math.round(Math.max(first, Math.min(last, y + travel)));
      wheelSpeed = 0;
      if (Math.abs(to - y) >= 2) {
        glide = { from: y, to, start: performance.now(), duration: 760, lastSet: y, coast: true };
      }
      return;
    }
    const to = Math.round(Math.min(maxScroll(), Math.max(0, target(y))));
    direction = 0;
    if (Math.abs(to - y) < 1) return;
    const distance = Math.abs(to - y);
    const duration = Math.min(1700, 820 + Math.sqrt(distance) * 19);
    glide = { from: y, to, start: performance.now(), duration, lastSet: y };
    log?.(`glide ${Math.round(y)} -> ${to}`);
  }

  function step(now: number) {
    frame = 0;
    if (glide) {
      // Someone else moved the page (scrollbar, find-in-page, an anchor): give way.
      if (glide.coast && blocked()) {
        glide = null;
      } else if (Math.abs(window.scrollY - glide.lastSet) > 3) {
        input();
      } else {
        const t = Math.min(1, (now - glide.start) / glide.duration);
        const e = glide.coast ? 1 - (1 - t) ** 3 : t * t * t * (t * (t * 6 - 15) + 10);
        const y = glide.from + (glide.to - glide.from) * e;
        window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
        glide.lastSet = window.scrollY;
        if (t >= 1) glide = null;
      }
    } else if (pending) {
      framesSinceInput += 1;
      const coasting = wheelSpeed !== 0 && freeScroll(window.scrollY);
      if (!held && !blocked() && framesSinceInput >= (coasting ? 2 : QUIET_FRAMES) && now - lastInput >= (coasting ? 48 : QUIET_MS)) startGlide();
    }
    if (glide || pending) wake();
  }
  function wake() {
    if (!frame) frame = requestAnimationFrame(step);
  }

  // ---- Inputs.
  let lastWheel = 0;
  window.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.deltaY === 0) return;
    const now = performance.now();
    const tail = Math.abs(e.deltaY) <= MOMENTUM_TAIL_PX && now - lastWheel < 400;
    const interval = now - lastWheel;
    lastWheel = now;
    if (freeScroll(window.scrollY) && !blocked() && !held) {
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      const speed = e.deltaY * unit / (interval > 130 ? 36 : Math.max(12, interval));
      wheelSpeed = interval < 130 && Math.sign(speed) === Math.sign(wheelSpeed)
        ? wheelSpeed * 0.45 + speed * 0.55 : speed;
    } else wheelSpeed = 0;
    // Momentum stragglers keep the reader's gesture alive but never cancel a glide that has begun.
    if (tail && glide && !glide.coast) return;
    input(Math.sign(e.deltaY));
  }, { passive: true });
  window.addEventListener("scroll", () => {
    // Our own glide moves the page too; only count movement we did not make.
    if (glide && Math.abs(window.scrollY - glide.lastSet) <= 3) return;
    if (!glide && freeScroll(window.scrollY)) { if (!wheelSpeed) pending = false; return; }
    if (!pending && !glide) origin = window.scrollY;
    input();
  }, { passive: true });
  window.addEventListener("keydown", (e) => {
    wheelSpeed = 0;
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Home", "End"].includes(e.key)) input();
  });
  const press = () => {
    wheelSpeed = 0;
    held = true;
    input();
  };
  const release = () => {
    held = false;
    if (pending) {
      lastInput = performance.now();
      framesSinceInput = 0;
      wake();
    }
  };
  window.addEventListener("pointerdown", press, { passive: true });
  window.addEventListener("pointerup", release, { passive: true });
  window.addEventListener("pointercancel", release, { passive: true });
  window.addEventListener("touchstart", press, { passive: true });
  window.addEventListener("touchend", (e) => e.touches.length === 0 && release(), { passive: true });
  window.addEventListener("touchcancel", release, { passive: true });
  window.addEventListener("blur", () => {
    held = false;
    wheelSpeed = 0;
    pending = false;
    glide = null;
  });

  return {
    /** Glide to a position chosen by the page (menu, chapter buttons) and rest there. */
    to(y: number) {
      wheelSpeed = 0;
      pending = false;
      const to = Math.round(Math.min(maxScroll(), Math.max(0, y)));
      const distance = Math.abs(to - window.scrollY);
      if (distance < 1) return;
      glide = { from: window.scrollY, to, start: performance.now(), duration: Math.min(1600, 600 + Math.sqrt(distance) * 9), lastSet: window.scrollY };
      wake();
    },
    /** The range input now owns the page position. */
    cancel() {
      wheelSpeed = 0;
      glide = null;
      pending = false;
      direction = 0;
    },
  };
}
