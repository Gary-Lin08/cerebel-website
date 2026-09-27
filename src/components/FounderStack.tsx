import {
  motion,
  useMotionTemplate,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef, useState } from "react";
import { teamAffiliations } from "../content";
import { useCompact } from "../hooks";
import { Reveal } from "./motion/Reveal";
import { scrollSpring } from "./motion/spring";

const photos = {
  lab: {
    src: "/assets/founders/founder-lab.jpg",
    srcSet:
      "/assets/founders/founder-lab-sm.jpg 1400w, /assets/founders/founder-lab.jpg 2400w",
    alt: "Cerebel studio photographed through annotated glass.",
  },
  desk: {
    src: "/assets/founders/founder-desk.jpg",
    srcSet:
      "/assets/founders/founder-desk-sm.jpg 1400w, /assets/founders/founder-desk.jpg 2400w",
    alt: "A Cerebel workbench with latency notes and capture hardware.",
  },
  team: {
    src: "/assets/founders/founder-team.jpg",
    srcSet:
      "/assets/founders/founder-team-sm.jpg 1400w, /assets/founders/founder-team.jpg 2400w",
    alt: "Cerebel founding team in the studio.",
  },
} as const;

const phases = [
  {
    id: "lab",
    label: "Lab",
    copy: "The work starts as notes on glass — before it becomes a capture system.",
  },
  {
    id: "prototype",
    label: "Prototype",
    copy: "A bench, a latency sketch, and hardware that is still being argued with.",
  },
  {
    id: "team",
    label: "Team",
    copy: "Built by people who still move through the problem themselves.",
  },
  {
    id: "vision",
    label: "Vision",
    copy: "Intelligent systems must understand how humans move. Cerebel is building the wearable capture for that transition.",
  },
] as const;

function AffiliationBoard() {
  return (
    <>
      <div className="vision__affil-meta">
        <p>Founding team</p>
        <span>
          Academic affiliations of the founding team — not university
          partnerships.
        </span>
      </div>
      <div className="vision__affil-grid">
        {teamAffiliations.map((group) => (
          <article
            key={group.id}
            className={
              group.marks.length > 1
                ? `vision__affil vision__affil--pair vision__affil--${group.id}`
                : `vision__affil vision__affil--${group.id}`
            }
          >
            <header>
              <span>{group.role}</span>
              <p>{group.caption}</p>
            </header>
            <div className="vision__affil-marks">
              {group.marks.map((mark) => (
                <a
                  key={mark.name}
                  href={mark.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={mark.src}
                    alt={mark.name}
                    width={mark.width}
                    height={mark.height}
                    loading="lazy"
                    decoding="async"
                  />
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export function FounderStack() {
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const mobileStageRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState(0);
  const compact = useCompact();
  const cinematic = !compact && !reduceMotion;
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, scrollSpring);
  const { scrollYProgress: mobileStageScroll } = useScroll({
    target: mobileStageRef,
    offset: ["start end", "end start"],
  });
  const mobileProgress = useSpring(mobileStageScroll, {
    stiffness: 112,
    damping: 24,
    mass: 0.72,
  });

  useMotionValueEvent(progress, "change", (value) => {
    if (compact) return;
    const next = value < 0.26 ? 0 : value < 0.46 ? 1 : value < 0.68 ? 2 : 3;
    setPhase((current) => (current === next ? current : next));
  });

  const labOpacity = useTransform(progress, [0, 0.22, 0.3], [1, 1, 0]);
  const labScale = useTransform(progress, [0, 0.08, 0.3], [1.03, 1, 1]);

  const deskOpacity = useTransform(progress, [0.22, 0.3, 0.44, 0.52], [0, 1, 1, 0]);
  const deskScale = useTransform(progress, [0.22, 0.32, 0.52], [1.04, 1, 1]);

  const teamOpacity = useTransform(progress, [0.44, 0.52], [0, 1]);
  const teamScale = useTransform(progress, [0.44, 0.54, 0.9], [1.03, 1, 1]);
  const teamBlur = useTransform(progress, [0.44, 0.54], [6, 0]);
  const teamFilter = useMotionTemplate`blur(${teamBlur}px)`;

  const creditsOpacity = useTransform(progress, [0.5, 0.58], [0, 1]);
  const blobX = useTransform(progress, [0, 1], ["18%", "72%"]);
  const blobOpacity = useTransform(progress, [0, 0.4, 1], [0.16, 0.28, 0.22]);
  const mobileBlobX = useTransform(mobileProgress, [0, 1], ["-12%", "18%"]);
  const mobileBlobOpacity = useTransform(
    mobileProgress,
    [0, 0.45, 1],
    [0.12, 0.3, 0.18],
  );
  const mobileImageY = useTransform(mobileProgress, [0, 1], ["-3%", "3%"]);
  const mobileImageScale = useTransform(mobileProgress, [0, 1], [1.08, 1.02]);

  const active = phases[compact || reduceMotion ? 2 : phase];

  return (
    <div
      className={compact ? "founder-stack is-compact" : "founder-stack"}
      ref={trackRef}
    >
      <div className="founder-stack__sticky">
        <motion.div
          className="founder-stack__blob"
          aria-hidden="true"
          style={
            cinematic
              ? { opacity: blobOpacity, x: blobX }
              : compact && !reduceMotion
                ? { opacity: mobileBlobOpacity, x: mobileBlobX }
                : undefined
          }
        />

        <div className="founder-stack__frame">
          <motion.div
            className="founder-stack__copy"
            data-mobile-motion={compact ? "copy" : undefined}
            initial={
              compact && !reduceMotion
                ? { opacity: 0, y: 28, filter: "blur(10px)" }
                : false
            }
            // Always resolve to the visible state: a compact first render can
            // leave the hidden initial styles applied after the viewport widens.
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.32 }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="eyebrow">
              <span aria-hidden="true" />
              Company
            </p>

            <div className="founder-stack__titles">
              {compact ? (
                <h2 className="founder-stack__title">
                  Built by People
                  <br />
                  Who Move
                </h2>
              ) : (
                <Reveal
                  as="h2"
                  className="founder-stack__title"
                  text={["Built by People", "Who Move"]}
                  delay={0.08}
                />
              )}
            </div>

            <div className="founder-stack__phases" aria-label="Studio chapters">
              {phases.map((item, index) => (
                <motion.span
                  key={item.id}
                  className={
                    item.id === active.id
                      ? "founder-stack__phase is-active"
                      : "founder-stack__phase"
                  }
                  initial={
                    compact && !reduceMotion ? { opacity: 0, x: -8 } : false
                  }
                  whileInView={
                    compact && !reduceMotion ? { opacity: 1, x: 0 } : undefined
                  }
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{
                    duration: 0.46,
                    delay: 0.2 + index * 0.07,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <i />
                  {item.label}
                  {index < phases.length - 1 ? <em aria-hidden="true" /> : null}
                </motion.span>
              ))}
            </div>

            <p className="founder-stack__caption">{active.copy}</p>
          </motion.div>

          <motion.div
            ref={mobileStageRef}
            className="founder-stack__stage"
            data-mobile-motion={compact ? "photo" : undefined}
            initial={
              compact && !reduceMotion
                ? {
                    opacity: 0.3,
                    clipPath: "inset(12% 0% 12% 0% round 20px)",
                  }
                : false
            }
            whileInView={
              compact && !reduceMotion
                ? {
                    opacity: 1,
                    clipPath: "inset(0% 0% 0% 0% round 20px)",
                  }
                : undefined
            }
            viewport={{ once: true, amount: 0.26 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            {compact ? null : (
              <>
                <motion.figure
                  className="founder-stack__photo founder-stack__photo--lab"
                  style={{ opacity: labOpacity, scale: labScale }}
                >
                  <img
                    src={photos.lab.src}
                    srcSet={photos.lab.srcSet}
                    sizes="56vw"
                    alt=""
                    width="2400"
                    height="1600"
                  />
                </motion.figure>

                <motion.figure
                  className="founder-stack__photo founder-stack__photo--desk"
                  style={{ opacity: deskOpacity, scale: deskScale }}
                >
                  <img
                    src={photos.desk.src}
                    srcSet={photos.desk.srcSet}
                    sizes="56vw"
                    alt=""
                    width="2400"
                    height="1600"
                  />
                </motion.figure>
              </>
            )}

            <motion.figure
              className="founder-stack__photo founder-stack__photo--team"
              style={
                cinematic
                  ? {
                      opacity: teamOpacity,
                      scale: teamScale,
                      filter: teamFilter,
                    }
                  : undefined
              }
            >
              <motion.img
                src={photos.team.src}
                srcSet={photos.team.srcSet}
                sizes="(max-width: 900px) 92vw, 56vw"
                alt={photos.team.alt}
                width="2400"
                height="1600"
                style={
                  compact && !reduceMotion
                    ? { y: mobileImageY, scale: mobileImageScale }
                    : undefined
                }
              />
              <figcaption>{active.label}</figcaption>
            </motion.figure>
          </motion.div>

          {compact ? null : (
            <motion.div
              className="founder-stack__credits founder-stack__credits--overlay"
              style={cinematic ? { opacity: creditsOpacity } : undefined}
            >
              <AffiliationBoard />
            </motion.div>
          )}
        </div>
      </div>

      {compact ? (
        <motion.div
          className="founder-stack__credits founder-stack__credits--flow"
          data-mobile-motion="affiliations"
          initial={
            reduceMotion
              ? false
              : { opacity: 0, y: 30, clipPath: "inset(0 0 12% 0 round 20px)" }
          }
          whileInView={
            reduceMotion
              ? undefined
              : { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0 round 20px)" }
          }
          viewport={{ once: true, amount: 0.14 }}
          transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
        >
          <AffiliationBoard />
        </motion.div>
      ) : null}
    </div>
  );
}
