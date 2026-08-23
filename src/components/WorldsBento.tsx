import { ArrowUpRight } from "@phosphor-icons/react/ArrowUpRight";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
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

export function WorldsBento() {
  const reduceMotion = useReducedMotion();
  const compact = useCompact();
  const [selectedSport, setSelectedSport] = useState<SportId>("ski");

  return (
    <div className="worlds-bento">
      <motion.a
        className="world-tile world-tile--apocynthion"
        href={apocynthionHref}
        target="_blank"
        rel="noreferrer"
        aria-label="Apocynthion — visit apocynthion.ai"
        {...enter(reduceMotion, 0, compact)}
      >
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
        <span>
          ArenaLabs builds AlphaMotion — a cross-hardware motion foundation
          model. The cerebellum for humanoid robots.
        </span>
        <em>
          Visit Apocynthion
          <ArrowUpRight aria-hidden="true" />
        </em>
      </motion.a>

      <motion.article
        className="world-tile world-tile--sports"
        {...enter(reduceMotion, 1, compact)}
      >
        <div className="sports-tile__copy">
          <p>Athletic coaching</p>
          <h3>Keep the athlete in their own sport.</h3>
          <span>
            Wearable capture for skiing, golf, and tennis — recover stance,
            swing, and line as a coaching signal instead of a sensor suit.
          </span>

          <div
            className="sports-tile__tabs"
            aria-label="Athletic coaching scenes"
          >
            {sports.map((sport) => (
              <button
                key={sport.id}
                type="button"
                aria-pressed={selectedSport === sport.id}
                onClick={() => setSelectedSport(sport.id)}
              >
                {sport.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sports-contact-sheet" aria-live="polite">
          {sports.map((sport) => (
            <figure
              key={sport.id}
              className={`sports-frame sports-frame--${sport.id}`}
              data-selected={selectedSport === sport.id}
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
      </motion.article>

      <motion.a
        className="world-tile world-tile--overide"
        href={overideHref}
        target="_blank"
        rel="noreferrer"
        aria-label="Overide — visit Overide Outdoors on Instagram"
        {...enter(reduceMotion, 2, compact)}
      >
        <img
          className="world-tile__photo"
          src="/assets/overide-field.jpg"
          alt=""
        />
        <p>Partnership</p>
        <strong>Overide</strong>
        <span>
          SnowyOwl snowboard brand — on-mountain capture with Overide Halo.
        </span>
        <em>
          Visit Overide
          <ArrowUpRight aria-hidden="true" />
        </em>
      </motion.a>

      <motion.a
        className="world-tile world-tile--next"
        href="#demo"
        {...enter(reduceMotion, 3, compact)}
      >
        <p>Next field</p>
        <h3>Bring another world in.</h3>
        <span>Robotics, sport, or a wearable product partnership.</span>
        <ArrowUpRight aria-hidden="true" />
      </motion.a>
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
    },
  };
}
