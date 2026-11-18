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
  /** True while something else owns the page (menu, drag, reduced motion, not started). */
  blocked: () => boolean;
  log?: (line: string) => void;
};

export function createSnap({ stops, freeScroll, blocked, log }: Options) {
  const root = document.scrollingElement || document.documentElement;
  const maxScroll = () => root.scrollHeight - root.clientHeight;

  let pending = false; // the reader has moved the page and it has not been brought to rest yet
  let lastInput = 0;
  let framesSinceInput = 0;
  let direction = 0; // +1 down, -1 up, 0 unknown
  let origin = window.scrollY; // where the current gesture started
  let held = false; // a finger or button is down
  let glide: { from: number; to: number; start: number; duration: number; lastSet: number } | null = null;
  let frame = 0;

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
    if (heading > 0) return progress >= COMMIT ? above : below;
    if (heading < 0) return progress <= 1 - COMMIT ? below : above;
    return progress < 0.5 ? below : above;
  }

  function startGlide() {
    const y = window.scrollY;
    pending = false;
    if (freeScroll(y)) return;
    const to = Math.round(Math.min(maxScroll(), Math.max(0, target(y))));
    direction = 0;
    if (Math.abs(to - y) < 1) return;
    const distance = Math.abs(to - y);
    // Long enough to read as a soft settle, never a jump: up to 0.9 s across a chapter.
    const duration = Math.min(900, 340 + Math.sqrt(distance) * 10);
    glide = { from: y, to, start: performance.now(), duration, lastSet: y };
    log?.(`glide ${Math.round(y)} -> ${to}`);
  }

  function step(now: number) {
    frame = 0;
    if (glide) {
      // Someone else moved the page (scrollbar, find-in-page, an anchor): give way.
      if (Math.abs(window.scrollY - glide.lastSet) > 3) {
        input();
      } else {
        const t = Math.min(1, (now - glide.start) / glide.duration);
        const e = t * t * t * (t * (t * 6 - 15) + 10); // smootherstep: gentle at both ends
        const y = glide.from + (glide.to - glide.from) * e;
        window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
        glide.lastSet = window.scrollY;
        if (t >= 1) glide = null;
      }
    } else if (pending) {
      framesSinceInput += 1;
      if (!held && !blocked() && framesSinceInput >= QUIET_FRAMES && now - lastInput >= QUIET_MS) startGlide();
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
    lastWheel = now;
    // Momentum stragglers keep the reader's gesture alive but never cancel a glide that has begun.
    if (tail && glide) return;
    input(Math.sign(e.deltaY));
  }, { passive: true });
  window.addEventListener("scroll", () => {
    // Our own glide moves the page too; only count movement we did not make.
    if (glide && Math.abs(window.scrollY - glide.lastSet) <= 3) return;
    if (!glide && freeScroll(window.scrollY)) { pending = false; return; }
    if (!pending && !glide) origin = window.scrollY;
    input();
  }, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Home", "End"].includes(e.key)) input();
  });
  const press = () => {
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
    glide = null;
  });

  return {
    /** Glide to a position chosen by the page (menu, chapter buttons) and rest there. */
    to(y: number) {
      pending = false;
      const to = Math.round(Math.min(maxScroll(), Math.max(0, y)));
      const distance = Math.abs(to - window.scrollY);
      if (distance < 1) return;
      glide = { from: window.scrollY, to, start: performance.now(), duration: Math.min(1600, 600 + Math.sqrt(distance) * 9), lastSet: window.scrollY };
      wake();
    },
    /** The range input now owns the page position. */
    cancel() {
      glide = null;
      pending = false;
      direction = 0;
    },
  };
}
