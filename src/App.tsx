import { ArrowDown } from "@phosphor-icons/react/ArrowDown";
import { Eyeglasses } from "@phosphor-icons/react/Eyeglasses";
import { Scan } from "@phosphor-icons/react/Scan";
import {
  motion,
  useReducedMotion,
} from "motion/react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DemoForm } from "./components/DemoForm";
import { BenchmarkBubbleAtlas } from "./components/BenchmarkBubbleAtlas";
import { LegacyCerebelScrollSequence as CerebelScrollSequence } from "./components/CerebelScrollSequence";
import { FounderStack } from "./components/FounderStack";
import { LogoPage } from "./components/LogoPage";
import { MagneticButton } from "./components/MagneticButton";
import { ParticleMorphHero } from "./components/ParticleMorphHero";
import { Navigation } from "./components/Navigation";
import { SectionHeading } from "./components/SectionHeading";
import { WorldsBento } from "./components/WorldsBento";
import { MotionSection } from "./components/motion/MotionSection";
import { navItems, technologyLayers } from "./content";
import { useActiveSection, useCompact } from "./hooks";
import { useAnalytics } from "./analytics";

const MotionViewerWorkspace = lazy(() =>
  import("./viewer/ViewerApp").then((module) => ({ default: module.MotionViewerWorkspace })),
);

const sectionIds = [
  "top",
  "wearable",
  "technology",
  "evidence",
  "benchmark",
  "field",
  "company",
  "demo",
];

export function App() {
  useAnalytics();
  const activeSection = useActiveSection(sectionIds);

  if (typeof window !== "undefined" && window.location.pathname === "/logo") {
    return <LogoPage />;
  }

  return (
    <div className="site-shell site-shell--refined">
      <Navigation activeSection={activeSection} />
      <SectionProgress activeSection={activeSection} />
      <main>
        <Hero />
        <CerebelScrollSequence />
        <TechnologyStack />
        <CaptureEvidence />
        <Benchmark />
        <FieldWorlds />
        <CompanyVision />
        <Demo />
      </main>
      <Footer />
    </div>
  );
}

const heroLines = ["Capture human motion.", "Train intelligent machines."];
function Hero() {
  const reduceMotion = useReducedMotion();
  const compact = useCompact();
  const skipReveal = Boolean(reduceMotion || compact);

  return (
    <section className="hero" id="top">
      <div className="hero__intro">
        <h1 aria-label="Capture human motion. Train intelligent machines.">
          {heroLines.map((line, lineIndex) => (
            <span className="hero__line" key={line}>
              {line.split(" ").map((word, wordIndex) => (
                <motion.span
                  key={`${line}-${word}-${wordIndex}`}
                  initial={skipReveal ? false : { y: "110%", opacity: 0 }}
                  animate={{ y: "0%", opacity: 1 }}
                  transition={{
                    duration: 0.92,
                    delay: 0.08 + lineIndex * 0.16 + wordIndex * 0.05,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  {word}
                </motion.span>
              ))}
            </span>
          ))}
        </h1>

        <p className="hero__lede">
          <span className="hero__lede-copy">We make human physical intelligence legible to machines —</span>
          <span className="hero__lede-flow">
            from
            <HeroChip delay={0.55} icon={<Eyeglasses weight="bold" />}>
              wearable view
            </HeroChip>
            to
            <HeroChip delay={0.7} icon={<Scan weight="bold" />}>
              articulated body
            </HeroChip>
            on one timeline.
          </span>
        </p>

        <div className="hero__actions">
          <MagneticButton href="#demo">Request a Demo</MagneticButton>
          <MagneticButton href="#evidence" variant="secondary" icon="down">
            See the Proof
          </MagneticButton>
        </div>
      </div>

      <motion.div
        className="hero__stage"
        initial={reduceMotion ? false : { y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <ParticleMorphHero />
      </motion.div>

      <a className="hero__evidence-threshold" href="#evidence">
        <span>Evidence</span>
        <strong>One action. Two synchronized views.</strong>
        <small>Inspect the paired capture <ArrowDown aria-hidden="true" /></small>
      </a>
    </section>
  );
}

function HeroChip({
  children,
  delay,
  icon,
}: {
  children: string;
  delay: number;
  icon: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const compact = useCompact();

  return (
    <motion.span
      className="hero-chip"
      initial={reduceMotion || compact ? false : { y: 12, opacity: 0, scale: 0.86 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {icon}
      {children}
    </motion.span>
  );
}

function DataGap() {
  const approaches = [
    {
      label: "Traditional motion capture",
      copy: "Accurate and structured, but typically dependent on controlled environments, specialized equipment, and complex setup.",
      position: "start",
    },
    {
      label: "Raw egocentric video",
      copy: "Natural and scalable, but requires substantial reconstruction, synchronization, annotation, and post-processing.",
      position: "center",
    },
    {
      label: "Cerebel",
      copy: "Lightweight wearable capture that transforms natural human activity into structured motion and interaction data.",
      position: "end",
    },
  ] as const;

  return (
    <section className="section data-gap data-gap--from-founder" id="data-gap">
      <div className="page-grid">
        <SectionHeading
          eyebrow="Motion intelligence research"
          title={[
            "Human behavior is abundant.",
            "Usable motion data is not.",
          ]}
          copy="Intelligent physical systems need real-world demonstrations, but portability and structured output rarely arrive in the same collection system."
        />

        <div className="continuum">
          <div className="continuum__axis" aria-hidden="true">
            <span />
            <i />
            <i />
            <i />
          </div>
          <div className="continuum__approaches">
            {approaches.map((approach, index) => (
              <MotionSection
                as="article"
                key={approach.label}
                className={`continuum__item continuum__item--${approach.position}`}
                delay={index * 0.08}
              >
                <span className="continuum__index">0{index + 1}</span>
                <h3>{approach.label}</h3>
                <p>{approach.copy}</p>
              </MotionSection>
            ))}
          </div>
          <div
            className="continuum__dimensions"
            aria-label="Qualitative dimensions"
          >
            {[
              "Portability",
              "Structured data",
              "Deployment friction",
              "Real-world scale",
            ].map((dimension, index) => (
              <div key={dimension}>
                <span>{dimension}</span>
                <div aria-hidden="true">
                  <i style={{ width: `${48 + index * 11}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="continuum__note">
            Qualitative positioning only — no unsupported performance scores.
          </p>
        </div>
      </div>
    </section>
  );
}

function CaptureEvidence() {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.3 || reduceMotion || connection?.saveData) {
        video.pause();
      } else {
        void video.play().catch(() => { /* Native controls remain available. */ });
      }
    }, { threshold: 0.3 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [reduceMotion]);

  return (
    <section className="section evidence" id="evidence">
      <div className="page-grid">
        <SectionHeading
          compact
          eyebrow="Reconstruction evidence"
          title="One action. Two synchronized views."
          copy="A real Cerebel capture, with wearable video and body reconstruction on the same timeline."
        />

        <figure className="evidence__figure">
          <div className="evidence__chrome">
            <strong>Jay / 27 Jul 2026</strong>
            <small>Wearable RGB + body reconstruction</small>
          </div>
          <div className="evidence__labels" aria-hidden="true">
            <span>
              <i />
              Body reconstruction
            </span>
            <span>
              <i />
              Wearable RGB
            </span>
          </div>
          <video
            ref={videoRef}
            className="evidence__video"
            controls
            muted
            loop
            playsInline
            preload="metadata"
            poster="/assets/egocentric-smpl-synchronized-demo-poster.jpg"
            aria-label="Jay's original synchronized Cerebel demo, showing the reconstructed body on the left and the wearable camera view on the right."
          >
            <source
              src="/assets/egocentric-smpl-synchronized-demo.mp4"
              type="video/mp4"
            />
            Your browser does not support embedded video.
          </video>

          <figcaption>
            <span>Original paired capture · 24.4 seconds</span>
            <p>Qualitative evidence. Original composite, as delivered.</p>
          </figcaption>
        </figure>

      </div>
    </section>
  );
}

const benchmarkReference = {
  "32": [
    ["CeRebel", "129.8±1.1", "109.8±1.1", "0.98±0.00", "6.4±0.1"],
    ["NoShape", "138.1±1.1", "118.8±1.1", "0.94±0.01", "44.7±0.4"],
    ["EgoEgo", "184.0±1.5", "158.6±1.6", "0.81±0.01", "45.2±1.0"],
    ["VAE+Opt", "199.5±1.3", "191.4±1.4", "0.49±0.01", "78.0±1.5"],
  ],
  "128": [
    ["CeRebel", "119.7±1.3", "101.1±1.3", "1.00±0.00", "6.2±0.1"],
    ["NoShape", "128.1±1.3", "110.3±1.4", "0.98±0.01", "44.6±0.7"],
    ["EgoEgo", "167.4±2.1", "145.8±2.0", "0.92±0.01", "54.9±1.9"],
    ["VAE+Opt", "205.3±2.6", "192.3±2.8", "0.75±0.02", "67.8±3.1"],
  ],
} as const;

const benchmarkMetrics = [
  {
    label: "MPJPE",
    valueIndex: 1,
    direction: "lower",
    description: "Mean joint-position error",
  },
  {
    label: "PA-MPJPE",
    valueIndex: 2,
    direction: "lower",
    description: "Aligned joint-position error",
  },
  {
    label: "GND",
    valueIndex: 3,
    direction: "higher",
    description: "Ground-contact score",
  },
  {
    label: "T-head",
    valueIndex: 4,
    direction: "lower",
    description: "Head-trajectory error",
  },
] as const;

type BenchmarkMethod = (typeof benchmarkReference)["128"][number][0];

function Benchmark() {
  const [sequenceLength, setSequenceLength] =
    useState<keyof typeof benchmarkReference>("128");
  const [activeMethod, setActiveMethod] = useState<BenchmarkMethod>("CeRebel");
  const rows = benchmarkReference[sequenceLength];

  const sortRowsByMetric = (metric: (typeof benchmarkMetrics)[number]) =>
    [...rows].sort((a, b) => {
      const aValue = Number.parseFloat(a[metric.valueIndex]);
      const bValue = Number.parseFloat(b[metric.valueIndex]);
      return metric.direction === "lower" ? aValue - bValue : bValue - aValue;
    });

  const metricLeaders = benchmarkMetrics.map(
    (metric) => sortRowsByMetric(metric)[0][0],
  );
  const overallLeader = rows
    .map(([method]) => ({
      method,
      wins: metricLeaders.filter((leader) => leader === method).length,
    }))
    .sort((a, b) => b.wins - a.wins)[0];

  return (
    <section className="section benchmark" id="benchmark">
      <div className="page-grid">
        <header className="benchmark-intro">
          <div>
            <p className="eyebrow">AMASS · aggregate sequence evaluation</p>
            <h2>Measured, not implied.</h2>
          </div>
          <p>Compare CeRebel with reference methods. Explore one metric, then inspect the complete result.</p>
        </header>
        <div className="benchmark__explorer">
          <div className="benchmark-toolbar">
            <p><strong>{overallLeader.method}</strong> leads the listed methods <span>in {overallLeader.wins} of {benchmarkMetrics.length} metrics</span></p>
            <div className="benchmark__toggle" role="group" aria-label="Sequence length">
              {(["32", "128"] as const).map((length) => (
                <button key={length} type="button" className={sequenceLength === length ? "is-active" : ""} aria-pressed={sequenceLength === length} onClick={() => setSequenceLength(length)}>SEQ {length}</button>
              ))}
            </div>
          </div>

          <BenchmarkBubbleAtlas
            sequenceLength={sequenceLength}
            reference={benchmarkReference}
            activeMethod={activeMethod}
            onMethodChange={(method) =>
              setActiveMethod(method as BenchmarkMethod)
            }
          />

          <details className="benchmark__source-view">
            <summary>
              <span>
                <small>Source table</small>
                Evaluation notes & exact values
              </span>
              <ArrowDown aria-hidden="true" />
            </summary>

            <table className="benchmark__table">
              <caption className="sr-only">
                Team-supplied AMASS body-estimation values for sequence length{" "}
                {sequenceLength}, including CeRebel and published reference
                methods.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Method</th>
                  <th scope="col">
                    <abbr title="Mean per-joint position error">MPJPE</abbr> ↓
                  </th>
                  <th scope="col">
                    <abbr title="Procrustes-aligned mean per-joint position error">
                      PA-MPJPE
                    </abbr>{" "}
                    ↓
                  </th>
                  <th scope="col">
                    <abbr title="Ground-contact score">GND</abbr> ↑
                  </th>
                  <th scope="col">
                    <abbr title="Head trajectory error">T-head</abbr> ↓
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([method, mpjpe, paMpjpe, gnd, head], index) => (
                  <tr
                    key={method}
                    className={index === 0 ? "is-reference" : ""}
                  >
                    <th scope="row" data-label="Method">
                      {method}
                      {index === 0 ? <span>Leader</span> : null}
                    </th>
                    <td data-label="MPJPE ↓">{mpjpe}</td>
                    <td data-label="PA-MPJPE ↓">{paMpjpe}</td>
                    <td data-label="GND ↑">{gnd}</td>
                    <td data-label="T-head ↓">{head}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="benchmark__source">
              <p>
                AMASS aggregate evaluation supplied by the Cerebel team. Values
                and uncertainty are transcribed from the supplied excerpt.
                CeRebel: 50.45M parameters, team-confirmed. FLOPs and comparable
                reference-model parameter counts are not yet verified.
              </p>
              <p>
                ↓ lower is better &nbsp;·&nbsp; ↑ higher is better &nbsp;·&nbsp;
                uncertainty shown as reported
              </p>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

function TechnologyStack() {
  const remainingLayers = technologyLayers.filter(
    ([index]) => index !== "04" && index !== "05" && index !== "06",
  );

  return (
    <section className="section technology" id="technology">
      <div className="page-grid">
        <SectionHeading
          compact
          eyebrow="CeRebel motion representation"
          title="From movement signals to physical intelligence."
          copy="Choose an action. Explore its surface or inspect the video, body model, and joint motion."
        />

        <Suspense
          fallback={(
            <div className="viewer-embedded-loading" role="status">
              Preparing motion workspace
            </div>
          )}
        >
          <MotionViewerWorkspace embedded />
        </Suspense>

        <ul className="technology__layers">
          {remainingLayers.map(([, title, copy]) => (
            <li key={title}><strong>{title}</strong><p>{copy}</p></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FieldWorlds() {
  return (
    <section className="section field-worlds" id="field">
      <div className="page-grid">
        <SectionHeading
          compact
          eyebrow="In the field"
          title="Humanoids, athletes, and the brands that train them."
          copy="Working with Apocynthion and Overide to explore human motion in robotics and sport."
        />
        <WorldsBento />
      </div>
    </section>
  );
}

function CompanyVision() {
  return (
    <section className="founder" id="company">
      <FounderStack />
    </section>
  );
}

function Demo() {
  return (
    <section className="section demo" id="demo">
      <div className="page-grid demo__grid">
        <div className="demo__intro">
          <p className="eyebrow">
            <span aria-hidden="true" />
            Request a demo
          </p>
          <h2>Bring real-world human intelligence into your system.</h2>
          <p>
            Tell us what you are building. We can discuss capture requirements,
            sports coaching, research collaboration, product integration, or a custom wearable
            configuration. Share your requirements and our team will follow up.
          </p>
          <div className="demo__contact">
            <span>Direct contact</span>
            <a href="mailto:hello@cerebel.tech">hello@cerebel.tech</a>
          </div>
        </div>
        <DemoForm />
      </div>
    </section>
  );
}

function SectionProgress({ activeSection }: { activeSection: string }) {
  const index = useMemo(
    () => Math.max(0, sectionIds.indexOf(activeSection)),
    [activeSection],
  );

  return (
    <aside className="section-progress" aria-label="Page progress">
      <span>{String(index + 1).padStart(2, "0")}</span>
      <div aria-hidden="true">
        <i style={{ height: `${((index + 1) / sectionIds.length) * 100}%` }} />
      </div>
      <span>{String(sectionIds.length).padStart(2, "0")}</span>
    </aside>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="page-grid footer__grid">
        <div>
          <span className="wordmark">
            <img
              src="/assets/cerebel-wordmark.png"
              alt="Cerebel"
              width="595"
              height="194"
            />
          </span>
          <p>
            Wearable systems for structured human motion and interaction data.
          </p>
        </div>
        <div className="footer__links">
          {navItems.map(item => <a key={item.href} href={item.href}>{item.label}</a>)}
          <a href="#demo">Contact</a>
        </div>
        <div className="footer__links">
          <span>Direct contact</span>
          <a href="mailto:hello@cerebel.tech">hello@cerebel.tech</a>
        </div>
        <div className="footer__meta">
          <p>Built for the real world, not only the lab.</p>
          <span>© {new Date().getFullYear()} Cerebel AI</span>
        </div>
      </div>
    </footer>
  );
}
