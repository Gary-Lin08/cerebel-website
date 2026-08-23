import { Camera } from "@phosphor-icons/react/Camera";
import { Hand } from "@phosphor-icons/react/Hand";
import { Path } from "@phosphor-icons/react/Path";
import { Scan } from "@phosphor-icons/react/Scan";
import { Timer } from "@phosphor-icons/react/Timer";
import { motion, useReducedMotion } from "motion/react";
import { useCompact } from "../hooks";

const poster = "/assets/egocentric-smpl-synchronized-demo-poster.jpg";

const tiles = [
  "still",
  "sync",
  "wear",
  "body",
  "clock",
  "contact",
] as const;

const stepFocus: Record<number, (typeof tiles)[number][]> = {
  0: ["still", "wear"],
  1: ["body", "contact"],
  2: ["sync", "clock"],
  3: ["clock", "contact"],
};

const inspectionPoints = [
  { frame: "092", time: "00:02.8", label: "scene input" },
  { frame: "276", time: "00:08.3", label: "body + hand" },
  { frame: "543", time: "00:16.3", label: "time aligned" },
  { frame: "813", time: "00:24.4", label: "structured sequence" },
] as const;

export function InstrumentBento({ activeStep }: { activeStep: number }) {
  const reduceMotion = useReducedMotion();
  const compact = useCompact();
  const focus = stepFocus[activeStep] ?? stepFocus[0];
  const inspection = inspectionPoints[activeStep] ?? inspectionPoints[0];

  return (
    <div className="instrument-bento" aria-label="Capture instrument">
      <motion.article
        className={tileClass("still", focus)}
        {...tileMotion(reduceMotion || compact, 0)}
      >
        <header>
          <Scan aria-hidden="true" />
          <span>Synchronized source</span>
        </header>
        <img
          src={poster}
          alt="Still from Jay’s original paired capture: reconstruction on the left, wearable RGB on the right."
          width="1920"
          height="828"
        />
      </motion.article>

      <motion.article
        className={tileClass("sync", focus)}
        {...tileMotion(reduceMotion || compact, 1)}
      >
        <header>
          <Path aria-hidden="true" />
          <span>Time lock</span>
        </header>
        <div className="instrument-bento__sync-readout">
          <strong>{inspection.time}</strong>
          <span>inspection point / {inspection.label}</span>
        </div>
        <div
          className="instrument-bento__tracks"
          data-step={activeStep}
          aria-hidden="true"
        >
          <div>
            <small>Wearable RGB</small>
            <i className="instrument-bento__track">
              <b />
            </i>
          </div>
          <div>
            <small>Articulated body</small>
            <i className="instrument-bento__track instrument-bento__track--body">
              <b />
            </i>
          </div>
        </div>
        <p>One timeline. Both views move together.</p>
      </motion.article>

      <motion.article
        className={tileClass("wear", focus)}
        {...tileMotion(reduceMotion || compact, 2)}
      >
        <header>
          <Camera aria-hidden="true" />
          <span>Scene context</span>
        </header>
        <img
          src={poster}
          alt=""
          width="960"
          height="828"
          className="instrument-bento__crop instrument-bento__crop--wear"
        />
      </motion.article>

      <motion.article
        className={tileClass("body", focus)}
        {...tileMotion(reduceMotion || compact, 3)}
      >
        <header>
          <Hand aria-hidden="true" />
          <span>Recovered body</span>
        </header>
        <img
          src={poster}
          alt=""
          width="960"
          height="828"
          className="instrument-bento__crop instrument-bento__crop--body"
        />
      </motion.article>

      <motion.article
        className={tileClass("clock", focus)}
        {...tileMotion(reduceMotion || compact, 4)}
      >
        <header>
          <Timer aria-hidden="true" />
          <span>Frame index</span>
        </header>
        <div className="instrument-bento__frame-index" data-step={activeStep}>
          <div>
            <strong>{inspection.frame}</strong>
            <span>/ 813</span>
          </div>
          <i aria-hidden="true" />
        </div>
        <p>frame {inspection.frame} · {inspection.time} · qualitative evidence</p>
      </motion.article>

      <motion.article
        className={tileClass("contact", focus)}
        {...tileMotion(reduceMotion || compact, 5)}
      >
        <header>
          <Hand aria-hidden="true" />
          <span>Interaction window</span>
        </header>
        <div className="instrument-bento__contact-window">
          <img
            src={poster}
            alt=""
            width="960"
            height="828"
            className="instrument-bento__crop instrument-bento__crop--contact"
          />
          <i aria-hidden="true" />
          <div aria-hidden="true">
            <span>scene</span>
            <span>hand</span>
            <span>object context</span>
          </div>
        </div>
      </motion.article>
    </div>
  );
}

function tileClass(id: (typeof tiles)[number], focus: readonly string[]) {
  return `instrument-bento__tile instrument-bento__tile--${id}${
    focus.includes(id) ? " is-focus" : ""
  }`;
}

function tileMotion(reduceMotion: boolean | null, index: number) {
  return {
    initial: reduceMotion ? false : { opacity: 0, y: 18, scale: 0.978 },
    whileInView: { opacity: 1, y: 0, scale: 1 },
    viewport: { once: true, amount: 0.08, margin: "64px 0px -6% 0px" },
    transition: {
      duration: 0.8,
      delay: index * 0.05,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  };
}
