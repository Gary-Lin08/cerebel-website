import { ArrowUpRight } from "@phosphor-icons/react/ArrowUpRight";
import { ArrowsOutSimple } from "@phosphor-icons/react/ArrowsOutSimple";
import { X } from "@phosphor-icons/react/X";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { useCompact } from "../hooks";
import { appleEase } from "./motion/spring";

const overideHref = "https://www.instagram.com/overide_snowboards/";
const apocynthionHref = "https://apocynthion.ai/";

const sports = [
  {
    id: "ski",
    label: "Ski",
    moment: "Edge",
    image: "/assets/sports/ski-documentary.jpg",
    alt: "Skier carving through a snow-covered slope",
  },
  {
    id: "golf",
    label: "Golf",
    moment: "Rotation",
    image: "/assets/sports/golf-documentary.jpg",
    alt: "Golfer completing a full swing on an outdoor course",
  },
  {
    id: "tennis",
    label: "Tennis",
    moment: "Contact",
    image: "/assets/sports/tennis-documentary.jpg",
    alt: "Tennis player meeting the ball with a two-handed backhand",
  },
] as const;

type SportId = (typeof sports)[number]["id"];
type WorldId = "apocynthion" | "sports" | "overide";

const apocynthionCopy =
  "ArenaLabs builds AlphaMotion — a cross-hardware motion foundation model. The cerebellum for humanoid robots.";
const sportsCopy =
  "Wearable capture for skiing, golf, and tennis — recover stance, swing, and line as a coaching signal instead of a sensor suit.";
const overideCopy = "SnowyOwl snowboard brand — on-mountain capture with Overide Halo.";

// A tile opens from where it sits: the sheet is the same element, grown.
const sheetSpring = { type: "spring", stiffness: 300, damping: 32, mass: 0.9 } as const;

export function WorldsBento() {
  const reduceMotion = useReducedMotion();
  const compact = useCompact();
  const [selectedSport, setSelectedSport] = useState<SportId>("ski");
  const [open, setOpen] = useState<WorldId | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const openWorld = (id: WorldId, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setOpen(id);
  };
  const closeWorld = () => setOpen(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const page = document.getElementById("root");
    document.body.style.overflow = "hidden";
    // The sheet is portalled beside the page, so the page itself can go inert behind it.
    page?.setAttribute("inert", "");
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      page?.removeAttribute("inert");
      window.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  // A soft light follows the pointer across whichever tile it is over.
  const trackLight = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const tile = (event.target as HTMLElement).closest<HTMLElement>(".world-tile");
    if (!tile) return;
    const bounds = tile.getBoundingClientRect();
    tile.style.setProperty("--light-x", `${event.clientX - bounds.left}px`);
    tile.style.setProperty("--light-y", `${event.clientY - bounds.top}px`);
  };

  const layoutTransition = reduceMotion ? { duration: 0 } : sheetSpring;

  const sportTabs = (thumbId: string) => (
    <div className="sports-tile__tabs" aria-label="Athletic coaching scenes">
      {sports.map((sport) => (
        <button
          key={sport.id}
          type="button"
          aria-pressed={selectedSport === sport.id}
          onClick={() => setSelectedSport(sport.id)}
        >
          {selectedSport === sport.id ? (
            <motion.i
              className="sports-tile__thumb"
              layoutId={thumbId}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 32, mass: 0.8 }}
              aria-hidden="true"
            />
          ) : null}
          <span>{sport.label}</span>
        </button>
      ))}
    </div>
  );

  const activeSport = sports.find((sport) => sport.id === selectedSport) ?? sports[0];

  return (
    <div className="worlds-bento" onPointerMove={trackLight}>
      <motion.button
        type="button"
        layoutId="world-apocynthion"
        className="world-tile world-tile--apocynthion"
        aria-haspopup="dialog"
        onClick={(event) => openWorld("apocynthion", event.currentTarget)}
        {...enter(reduceMotion, 0, compact)}
      >
        <i className="world-tile__light" aria-hidden="true" />
        <svg
          className="world-tile__orbit"
          viewBox="0 0 280 420"
          aria-hidden="true"
        >
          <ellipse
            className={reduceMotion ? "" : "is-live"}
            cx="140"
            cy="168"
            rx="92"
            ry="36"
            transform="rotate(-28 140 168)"
          />
        </svg>
        <p>Humanoid partner</p>
        <img
          className="world-tile__mark"
          src="/assets/apocynthion-mark.png"
          alt=""
          width="360"
          height="306"
        />
        <strong>Apocynthion</strong>
        <span>{apocynthionCopy}</span>
        <em>
          Open
          <ArrowsOutSimple aria-hidden="true" />
        </em>
      </motion.button>

      <motion.article
        layoutId="world-sports"
        className="world-tile world-tile--sports"
        {...enter(reduceMotion, 1, compact)}
      >
        <i className="world-tile__light" aria-hidden="true" />
        <div className="sports-tile__copy">
          <p>Athletic coaching</p>
          <h3>Keep the athlete in their own sport.</h3>
          <span>{sportsCopy}</span>
          {sportTabs("sports-thumb")}
        </div>

        <div className="sports-contact-sheet" aria-live="polite">
          {sports.map((sport) => (
            <figure
              key={sport.id}
              className={`sports-frame sports-frame--${sport.id}`}
              data-selected={selectedSport === sport.id}
              // The photograph is a control too; the buttons above stay the keyboard path.
              onClick={() => setSelectedSport(sport.id)}
            >
              <img src={sport.image} alt={sport.alt} />
              <figcaption>
                <i aria-hidden="true" />
                <span>{sport.label}</span>
                <b aria-hidden="true">/</b>
                <span>{sport.moment}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <button
          type="button"
          className="world-tile__expand"
          aria-haspopup="dialog"
          aria-label="Open athletic coaching"
          onClick={(event) => openWorld("sports", event.currentTarget)}
        >
          <ArrowsOutSimple aria-hidden="true" />
        </button>
      </motion.article>

      <motion.button
        type="button"
        layoutId="world-overide"
        className="world-tile world-tile--overide"
        aria-haspopup="dialog"
        onClick={(event) => openWorld("overide", event.currentTarget)}
        {...enter(reduceMotion, 2, compact)}
      >
        <img
          className="world-tile__photo"
          src="/assets/overide-field.jpg"
          alt=""
        />
        <i className="world-tile__light" aria-hidden="true" />
        <p>Partnership</p>
        <strong>Overide</strong>
        <span>{overideCopy}</span>
        <em>
          Open
          <ArrowsOutSimple aria-hidden="true" />
        </em>
      </motion.button>

      <motion.a
        className="world-tile world-tile--next"
        href="#demo"
        {...enter(reduceMotion, 3, compact)}
      >
        <i className="world-tile__light" aria-hidden="true" />
        <p>Next field</p>
        <h3>Bring another world in.</h3>
        <span>Robotics, sport, or a wearable product partnership.</span>
        <ArrowUpRight aria-hidden="true" />
      </motion.a>

      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              key="layer"
              className={`world-sheet-layer world-sheet-layer--${open}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.28 }}
              onClick={closeWorld}
            >
              <i className="world-sheet-layer__glow" aria-hidden="true" />
              <motion.div
                layoutId={`world-${open}`}
                transition={layoutTransition}
                className={`world-sheet world-sheet--${open}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(event) => event.stopPropagation()}
              >
                <motion.div
                  className="world-sheet__content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: reduceMotion ? 0 : 0.14, duration: 0.3 } }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                >
                  {open === "apocynthion" ? (
                    <>
                      <div className="world-sheet__media world-sheet__media--apocynthion">
                        <svg viewBox="0 0 280 280" aria-hidden="true">
                          <ellipse
                            className={reduceMotion ? "" : "is-live"}
                            cx="140"
                            cy="140"
                            rx="118"
                            ry="46"
                            transform="rotate(-28 140 140)"
                          />
                        </svg>
                        <img src="/assets/apocynthion-mark.png" alt="" width="360" height="306" />
                      </div>
                      <div className="world-sheet__body">
                        <p className="world-sheet__eyebrow">Humanoid partner</p>
                        <h3 id={titleId}>Apocynthion</h3>
                        <p className="world-sheet__lede">{apocynthionCopy}</p>
                        <dl>
                          <div><dt>Company</dt><dd>Apocynthion Inc.</dd></div>
                          <div><dt>Product line</dt><dd>ArenaLabs</dd></div>
                          <div><dt>Product</dt><dd>AlphaMotion</dd></div>
                          <div><dt>With Cerebel</dt><dd>Exploring human motion in robotics</dd></div>
                        </dl>
                        <a className="world-sheet__link" href={apocynthionHref} target="_blank" rel="noreferrer">
                          Visit apocynthion.ai
                          <ArrowUpRight aria-hidden="true" />
                        </a>
                      </div>
                    </>
                  ) : null}

                  {open === "overide" ? (
                    <>
                      <div className="world-sheet__media">
                        <img src="/assets/overide-field.jpg" alt="Overide riders gathered on the snow in front of the lift." />
                      </div>
                      <div className="world-sheet__body">
                        <p className="world-sheet__eyebrow">Partnership</p>
                        <h3 id={titleId}>Overide</h3>
                        <p className="world-sheet__lede">{overideCopy}</p>
                        <dl>
                          <div><dt>Brand</dt><dd>Overide · 雪鸮科技 / 风脊者</dd></div>
                          <div><dt>Product</dt><dd>Overide Halo</dd></div>
                          <div><dt>Sport</dt><dd>Snowboarding</dd></div>
                          <div><dt>With Cerebel</dt><dd>Exploring human motion in sport</dd></div>
                        </dl>
                        <a className="world-sheet__link" href={overideHref} target="_blank" rel="noreferrer">
                          Overide Outdoors on Instagram
                          <ArrowUpRight aria-hidden="true" />
                        </a>
                      </div>
                    </>
                  ) : null}

                  {open === "sports" ? (
                    <>
                      <div className="world-sheet__media world-sheet__media--sports">
                        <AnimatePresence initial={false} mode="popLayout">
                          <motion.img
                            key={activeSport.id}
                            src={activeSport.image}
                            alt={activeSport.alt}
                            initial={{ opacity: 0, scale: 1.05 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: reduceMotion ? 0 : 0.5, ease: appleEase }}
                          />
                        </AnimatePresence>
                        <p>{activeSport.label} <b aria-hidden="true">/</b> {activeSport.moment}</p>
                      </div>
                      <div className="world-sheet__body">
                        <p className="world-sheet__eyebrow">Athletic coaching</p>
                        <h3 id={titleId}>Keep the athlete in their own sport.</h3>
                        <p className="world-sheet__lede">{sportsCopy}</p>
                        {sportTabs("sports-thumb-sheet")}
                        <a className="world-sheet__link" href="#technology" onClick={closeWorld}>
                          See a measured golf swing
                          <ArrowUpRight aria-hidden="true" />
                        </a>
                      </div>
                    </>
                  ) : null}
                </motion.div>

                <button type="button" className="world-sheet__close" ref={closeRef} onClick={closeWorld} aria-label="Close">
                  <X aria-hidden="true" />
                </button>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

function enter(reduceMotion: boolean | null, index: number, compact = false) {
  return {
    initial: reduceMotion || compact ? false : { opacity: 0, y: 22, scale: 0.975 },
    whileInView: { opacity: 1, y: 0, scale: 1 },
    viewport: { once: true, amount: 0.08, margin: "64px 0px -6% 0px" },
    transition: {
      duration: 0.82,
      delay: index * 0.07,
      ease: appleEase,
      // Returning from the open sheet is a spring, not the entrance tween.
      layout: reduceMotion ? { duration: 0 } : sheetSpring,
    },
  };
}
