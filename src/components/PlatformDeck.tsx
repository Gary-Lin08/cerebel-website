import { Aperture } from "@phosphor-icons/react/Aperture";
import { Brain } from "@phosphor-icons/react/Brain";
import { Stack } from "@phosphor-icons/react/Stack";
import { Timer } from "@phosphor-icons/react/Timer";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import {
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useCompact } from "../hooks";

const inputStreams = [
  {
    label: "Wearable RGB",
    role: "Visual anchor",
    detail: "The wearer’s field of view anchors the capture in real-world context.",
  },
  {
    label: "Optional IMU",
    role: "Motion signal",
    detail: "Inertial motion can be synchronized without replacing the image path.",
  },
  {
    label: "Auxiliary",
    role: "Task context",
    detail: "Additional streams can add task-specific context to the same event.",
  },
] as const;

const coreLayers = [
  {
    label: "Topology",
    detail: "Preserve the structure and relationships of the moving body.",
  },
  {
    label: "Geometry",
    detail: "Represent position, orientation, and spatial form.",
  },
  {
    label: "Dynamics",
    detail: "Understand motion as change through time.",
  },
  {
    label: "Biomechanics",
    detail: "Interpret movement through physical constraints.",
  },
] as const;

const synchronizedStreams = [
  {
    label: "Wearable RGB",
    role: "Visual clock",
    detail: "The image sequence establishes the event timeline and scene context.",
    code: "RGB / 00.000",
  },
  {
    label: "Optional IMU",
    role: "Motion clock",
    detail: "Inertial samples can stay aligned with the same observed movement.",
    code: "IMU / 00.000",
  },
  {
    label: "Auxiliary context",
    role: "Task clock",
    detail: "Additional task signals can enter without becoming a separate event.",
    code: "AUX / 00.000",
  },
] as const;

const outputModes = [
  {
    label: "Coaching",
    detail: "Translate movement into feedback and next actions.",
  },
  {
    label: "Assessment",
    detail: "Make technique comparable across sessions and workflows.",
  },
  {
    label: "Device intelligence",
    detail: "Give partner products a body-aware intelligence layer.",
  },
  {
    label: "Physical AI",
    detail: "Turn human behavior into structured demonstrations for machines.",
  },
] as const;

export function PlatformDeck() {
  const reduceMotion = useReducedMotion();
  const compact = useCompact();
  const [activeInput, setActiveInput] = useState(0);
  const [activeSync, setActiveSync] = useState(0);
  const [activeCore, setActiveCore] = useState(0);
  const [activeOutput, setActiveOutput] = useState(0);
  const parallaxX = useSpring(useMotionValue(0), {
    stiffness: 120,
    damping: 24,
    mass: 0.5,
  });
  const parallaxY = useSpring(useMotionValue(0), {
    stiffness: 120,
    damping: 24,
    mass: 0.5,
  });

  function handleInputMove(event: PointerEvent<HTMLDivElement>) {
    if (reduceMotion || compact) return;
    const rect = event.currentTarget.getBoundingClientRect();
    parallaxX.set(((event.clientX - rect.left) / rect.width - 0.5) * 12);
    parallaxY.set(((event.clientY - rect.top) / rect.height - 0.5) * 8);
  }

  function resetInputMove() {
    parallaxX.set(0);
    parallaxY.set(0);
  }

  return (
    <div className="platform-deck">
      <motion.article
        className="platform-card platform-card--optics"
        {...enter(reduceMotion || compact, 0)}
      >
        <div
          className="platform-card__window"
          onPointerMove={handleInputMove}
          onPointerLeave={resetInputMove}
        >
          <img
            src="/assets/platform/optical-path-v2.png"
            alt=""
            className="platform-card__background"
          />
          <InstrumentGlare />
          <InstrumentHeader
            icon={<Aperture weight="bold" aria-hidden="true" />}
            label="Optical path"
            meta="Multimodal input"
          />
          <motion.div
            className="capture-map"
            style={reduceMotion || compact ? undefined : { x: parallaxX, y: parallaxY }}
          >
            <div className="capture-map__streams" aria-label="Inspect capture inputs">
              {inputStreams.map((stream, index) => (
                <button
                  type="button"
                  key={stream.label}
                  className={activeInput === index ? "is-active" : ""}
                  aria-pressed={activeInput === index}
                  onClick={() => setActiveInput(index)}
                >
                  <span>0{index + 1}</span>
                  <strong>{stream.label}</strong>
                </button>
              ))}
            </div>
            <div className="capture-map__focus" aria-live="polite">
              <small>{inputStreams[activeInput].role}</small>
              <motion.strong
                key={`input-title-${activeInput}`}
                {...stateReveal(reduceMotion || compact)}
              >
                {inputStreams[activeInput].label}
              </motion.strong>
              <motion.p
                key={`input-detail-${activeInput}`}
                {...stateReveal(reduceMotion || compact, 0.025)}
              >
                {inputStreams[activeInput].detail}
              </motion.p>
              <span>ONE EVENT / SHARED CONTEXT</span>
            </div>
          </motion.div>
        </div>
        <CardCaption
          title="Many signals. One observation."
          body="Wide-field wearable video is the visual anchor; optional streams can add motion and task context around the same event."
        />
      </motion.article>

      <motion.article
        className="platform-card platform-card--sync"
        {...enter(reduceMotion || compact, 1)}
      >
        <div className="platform-card__window">
          <img
            src="/assets/platform/sensor-sync-v2.png"
            alt=""
            className="platform-card__background"
          />
          <InstrumentGlare />
          <InstrumentHeader
            icon={<Timer weight="bold" aria-hidden="true" />}
            label="Shared clock"
            meta="Synchronized sensing"
          />
          <div className="sync-map">
            <div className="sync-map__readout" aria-live="polite">
              <small>{synchronizedStreams[activeSync].role}</small>
              <motion.strong
                key={`sync-title-${activeSync}`}
                {...stateReveal(reduceMotion || compact)}
              >
                {synchronizedStreams[activeSync].label}
              </motion.strong>
              <motion.p
                key={`sync-detail-${activeSync}`}
                {...stateReveal(reduceMotion || compact, 0.025)}
              >
                {synchronizedStreams[activeSync].detail}
              </motion.p>
              <div className="sync-map__cursor" aria-hidden="true">
                <i />
                <span>EVENT ZERO</span>
              </div>
            </div>
            <div className="sync-map__tracks" aria-label="Inspect synchronized streams">
              {synchronizedStreams.map((stream, index) => (
                <button
                  type="button"
                  key={stream.label}
                  className={activeSync === index ? "is-active" : ""}
                  aria-pressed={activeSync === index}
                  onClick={() => setActiveSync(index)}
                >
                  <span>0{index + 1}</span>
                  <strong>{stream.label}</strong>
                  <small>{stream.code}</small>
                  <i aria-hidden="true"><b /></i>
                </button>
              ))}
            </div>
          </div>
        </div>
        <CardCaption
          title="One timeline, not three files."
          body="Visual and optional sensing streams remain attached to the same event, ready for temporal reconstruction."
        />
      </motion.article>

      <motion.article
        className="platform-card platform-card--compute"
        {...enter(reduceMotion || compact, 2)}
      >
        <div className="platform-card__window">
          <img
            src="/assets/platform/near-capture-compute-v2.png"
            alt=""
            className="platform-card__background"
          />
          <InstrumentGlare />
          <InstrumentHeader
            icon={<Brain weight="bold" aria-hidden="true" />}
            label="Motion core"
            meta="Physical representation"
          />
          <div className="core-map">
            <div className="core-map__rings" aria-hidden="true">
              {coreLayers.map((layer, index) => (
                <i
                  key={layer.label}
                  className={activeCore === index ? "is-active" : ""}
                  style={{ "--core-ring": index } as CSSProperties}
                />
              ))}
              <div>
                <small>Reusable core</small>
                <motion.strong
                  key={`core-title-${activeCore}`}
                  {...stateReveal(reduceMotion || compact)}
                >
                  {coreLayers[activeCore].label}
                </motion.strong>
              </div>
            </div>
            <div className="core-map__legend" aria-label="Inspect motion core layers">
              {coreLayers.map((layer, index) => (
                <button
                  type="button"
                  key={layer.label}
                  className={activeCore === index ? "is-active" : ""}
                  aria-pressed={activeCore === index}
                  onClick={() => setActiveCore(index)}
                >
                  <span>0{index + 1}</span>
                  <strong>{layer.label}</strong>
                </button>
              ))}
              <motion.p
                key={`core-detail-${activeCore}`}
                aria-live="polite"
                {...stateReveal(reduceMotion || compact)}
              >
                {coreLayers[activeCore].detail}
              </motion.p>
            </div>
          </div>
        </div>
        <CardCaption
          title="Physics before prediction."
          body="The core organizes body topology, geometry, dynamics, and biomechanics—not a one-off output for one device."
        />
      </motion.article>

      <motion.article
        className="platform-card platform-card--modules"
        {...enter(reduceMotion || compact, 3)}
      >
        <div className="platform-card__window">
          <img
            src="/assets/platform/modular-system-v2.png"
            alt=""
            className="platform-card__background"
          />
          <InstrumentGlare />
          <InstrumentHeader
            icon={<Stack weight="bold" aria-hidden="true" />}
            label="Domain modules"
            meta="Structured output"
          />
          <div className="output-map">
            <div className="output-map__source">
              <small>Shared representation</small>
              <strong>Cerebel Core</strong>
              <motion.p
                key={`output-detail-${activeOutput}`}
                aria-live="polite"
                {...stateReveal(reduceMotion || compact)}
              >
                {outputModes[activeOutput].detail}
              </motion.p>
            </div>
            <div className="output-map__routes" aria-label="Inspect platform outcomes">
              {outputModes.map((output, index) => (
                <button
                  type="button"
                  key={output.label}
                  className={activeOutput === index ? "is-active" : ""}
                  aria-pressed={activeOutput === index}
                  onClick={() => setActiveOutput(index)}
                >
                  <i aria-hidden="true"><b /></i>
                  <span>0{index + 1}</span>
                  <strong>{output.label}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>
        <CardCaption
          title="One representation. Many decisions."
          body="The same motion core can support coaching, assessment, partner-device intelligence, and selected physical-AI workflows."
        />
      </motion.article>
    </div>
  );
}

function InstrumentGlare() {
  return <span className="platform-card__glare" aria-hidden="true" />;
}

function InstrumentHeader({
  icon,
  label,
  meta,
}: {
  icon: ReactNode;
  label: string;
  meta: string;
}) {
  return (
    <div className="platform-instrument__header">
      <span>{icon}{label}</span>
      <small>{meta}</small>
    </div>
  );
}

function CardCaption({ title, body }: { title: string; body: string }) {
  return (
    <div className="platform-card__copy">
      <p><strong>{title}</strong> {body}</p>
    </div>
  );
}

function enter(reduceMotion: boolean | null, index: number) {
  return {
    initial: reduceMotion ? false : { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.08, margin: "64px 0px -6% 0px" },
    transition: {
      duration: 0.9,
      delay: index * 0.08,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  };
}

function stateReveal(reduced: boolean, delay = 0) {
  if (reduced) return { initial: false } as const;
  return {
    initial: { opacity: 0, y: 7, filter: "blur(5px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 0.38, delay, ease: [0.22, 1, 0.36, 1] },
  } as const;
}
