import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { applications } from "../content";
import { useCompact } from "../hooks";

type Application = (typeof applications)[number];

export function ApplicationCases({
  selected,
  onSelect,
}: {
  selected: Application;
  onSelect: (application: Application) => void;
}) {
  const reduceMotion = useReducedMotion();
  const compact = useCompact();

  return (
    <div className="app-cases">
      <div className="app-cases__grid" role="tablist" aria-label="Applications">
        {applications.map((application, index) => (
          <motion.button
            key={application.id}
            type="button"
            role="tab"
            id={`tab-${application.id}`}
            aria-selected={selected.id === application.id}
            aria-controls="application-panel"
            className={`app-case app-case--${application.id}${
              selected.id === application.id ? " is-selected" : ""
            }`}
            onClick={() => onSelect(application)}
            initial={reduceMotion || compact ? false : { opacity: 0, y: 18, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.08, margin: "64px 0px -6% 0px" }}
            transition={{
              duration: 0.78,
              delay: index * 0.06,
              ease: [0.16, 1, 0.3, 1],
            }}
            whileHover={reduceMotion ? undefined : { scale: 1.02 }}
          >
            <span>{application.index}</span>
            <strong>{application.name}</strong>
            <div className="app-case__graphic" aria-hidden="true">
              <CaseGraphic id={application.id} live={!reduceMotion} />
            </div>
          </motion.button>
        ))}
      </div>

      <div
        className="app-cases__panel"
        id="application-panel"
        role="tabpanel"
        aria-labelledby={`tab-${selected.id}`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={selected.id}
            initial={reduceMotion || compact ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <p>{selected.name}</p>
            <h3>{selected.title}</h3>
            <span>{selected.copy}</span>
            <ul>
              {selected.outputs.map((output) => (
                <li key={output}>{output}</li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function CaseGraphic({
  id,
  live,
}: {
  id: Application["id"];
  live: boolean;
}) {
  const className = live ? "is-live" : "";

  if (id === "robotics") {
    return (
      <svg className={className} viewBox="0 0 280 360">
        <path
          className="app-trail"
          d="M36 310 C 70 240, 90 200, 120 170 S 190 110, 230 64"
        />
        <circle className="app-tip" cx="230" cy="64" r="7" />
      </svg>
    );
  }

  if (id === "industrial") {
    return (
      <svg className={className} viewBox="0 0 240 140">
        {Array.from({ length: 11 }, (_, i) => (
          <rect
            key={i}
            className="app-beat"
            x={18 + i * 18}
            y={28}
            width="10"
            height="84"
            style={{ animationDelay: `${i * 110}ms` }}
          />
        ))}
      </svg>
    );
  }

  if (id === "sports") {
    return (
      <svg className={className} viewBox="0 0 240 140">
        <polyline
          className="app-bodyline"
          points="18,104 46,86 78,92 112,48 148,70 184,36 222,58"
        />
        <circle className="app-tip" cx="222" cy="58" r="5" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 360 120">
      {Array.from({ length: 16 }, (_, i) => (
        <line
          key={i}
          className="app-tick"
          x1={20 + i * 21}
          x2={20 + i * 21}
          y1="28"
          y2={i % 4 === 0 ? "92" : "64"}
        />
      ))}
      <rect className="app-cursor" x="20" y="22" width="3" height="76" />
    </svg>
  );
}
