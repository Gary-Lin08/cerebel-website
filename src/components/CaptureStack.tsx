import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useRef, type PointerEvent } from "react";
import { useCompact } from "../hooks";

const poster = "/assets/egocentric-smpl-synchronized-demo-poster.jpg";

const frames = [
  { t: "t + 24f", className: "capture-stack__pane--back", position: "38% center" },
  { t: "t + 12f", className: "capture-stack__pane--mid", position: "50% center" },
  { t: "t + 0", className: "capture-stack__pane--front", position: "62% center" },
] as const;

export function CaptureStack() {
  const reduceMotion = useReducedMotion();
  const compact = useCompact();
  const stageRef = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(useMotionValue(0), { stiffness: 160, damping: 22 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 160, damping: 22 });

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (reduceMotion || compact || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(x * 10);
    rotateX.set(y * -7);
  }

  function handlePointerLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <div
      className="capture-stack"
      ref={stageRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      aria-label="Stacked stills from the original paired capture."
    >
      <motion.div
        className="capture-stack__scene"
        style={reduceMotion ? undefined : { rotateX, rotateY }}
      >
        {frames.map((frame, index) => (
          <motion.figure
            key={frame.t}
            className={`capture-stack__pane ${frame.className}`}
            initial={reduceMotion || compact ? false : { opacity: 0, y: 36, rotate: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.82,
              delay: 0.18 + index * 0.1,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <img
              src={poster}
              alt=""
              width="1920"
              height="828"
              style={{ objectPosition: frame.position }}
            />
            <figcaption>
              <span>{frame.t}</span>
              <small>Paired capture</small>
            </figcaption>
          </motion.figure>
        ))}
      </motion.div>
      <p className="capture-stack__note">
        Jay / 27 Jul 2026 — stills from the original paired composite. Full
        playback lives in Evidence.
      </p>
    </div>
  );
}
