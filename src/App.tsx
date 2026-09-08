import { ArrowDown } from "@phosphor-icons/react/ArrowDown";
import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { ArrowUpRight } from "@phosphor-icons/react/ArrowUpRight";
import { Eyeglasses } from "@phosphor-icons/react/Eyeglasses";
import { Scan } from "@phosphor-icons/react/Scan";
import {
  motion,
  useReducedMotion,
} from "motion/react";
import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { DemoForm } from "./components/DemoForm";
import { BenchmarkBubbleAtlas } from "./components/BenchmarkBubbleAtlas";
import { CerebelScrollSequence } from "./components/CerebelScrollSequence";
import { FounderStack } from "./components/FounderStack";
import { InstrumentBento } from "./components/InstrumentBento";
import { LogoPage } from "./components/LogoPage";
import { MagneticButton } from "./components/MagneticButton";
import { ParticleMorphHero } from "./components/ParticleMorphHero";
import { Navigation } from "./components/Navigation";
import { SectionHeading } from "./components/SectionHeading";
import { WorldsBento } from "./components/WorldsBento";
import { MotionSection } from "./components/motion/MotionSection";
import { partnerCapabilities, processSteps, technologyLayers } from "./content";
import { useActiveSection, useCompact } from "./hooks";
import { useAnalytics } from "./analytics";

const MotionViewerWorkspace = lazy(() =>
  import("./viewer/ViewerApp").then((module) => ({ default: module.MotionViewerWorkspace })),
);

const sectionIds = [
  "top",
  "evidence",
  "technology",
  "field",
  "company",
  "benchmark",
  "demo",
];

export function App() {
  useAnalytics();
  const activeSection = useActiveSection(sectionIds);

  if (typeof window !== "undefined" && window.location.pathname === "/logo") {
    return <LogoPage />;
  }

  return (
    <div className="site-shell">
      <Navigation activeSection={activeSection} />
      <SectionProgress activeSection={activeSection} />
      <main>
        <Hero />
        <CaptureEvidence />
        <TechnologyStack />
        <CerebelScrollSequence />
        <FieldWorlds />
        <CompanyVision />
        <Benchmark />
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
          <MagneticButton href="#demo">Book a Demo</MagneticButton>
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
        <span><em>01</em>Evidence</span>
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

function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="how-it-works" id="how-it-works">
      <div className="how-it-works__sticky">
        <div className="page-grid">
          <SectionHeading
            eyebrow="How Cerebel works"
            title="From human action to machine intelligence."
          />

          <div className="process-layout">
            <div className="process-steps" role="list">
              {processSteps.map((step, index) => (
                <button
                  type="button"
                  role="listitem"
                  key={step.number}
                  className={
                    index === activeStep
                      ? "process-step is-active"
                      : "process-step"
                  }
                  onClick={() => setActiveStep(index)}
                  aria-current={index === activeStep ? "step" : undefined}
                >
                  <span>{step.number}</span>
                  <div>
                    <h3>{step.name}</h3>
                    <p>{step.copy}</p>
                  </div>
                </button>
              ))}
            </div>

            <InstrumentBento activeStep={activeStep} />
          </div>
        </div>
      </div>
    </section>
  );
}

function CaptureEvidence() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="section evidence" id="evidence">
      <div className="page-grid">
        <SectionHeading
          eyebrow="Reconstruction evidence"
          title="One action. Two synchronized views."
          copy="The wearable view preserves what the operator sees. The paired reconstruction makes the same motion legible as a time-aligned articulated body-and-hand sequence."
        />

        <figure className="evidence__figure">
          <div className="evidence__chrome">
            <span className="hero__chrome-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
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
            className="evidence__video"
            controls
            autoPlay={!reduceMotion}
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
            <span>ORIGINAL PAIRED CAPTURE / 00:24.4</span>
            <p>
              The original composite preserves the reconstruction and wearable
              view exactly as delivered. Qualitative inspection only.
            </p>
            <span>PLAYBACK / SYNCHRONIZED</span>
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
        <SectionHeading
          eyebrow="Benchmark protocol"
          title="Measured, not implied."
          copy="A benchmark should make the model’s behavior comparable—not merely impressive. CeRebel is compared with published reference methods on aggregate AMASS sequences. FLOPs and reference-model parameter encodings remain locked until those counts are verified on the same basis."
        />

        <aside
          className="benchmark__protocol-strip"
          aria-label="Evaluation protocol"
        >
          <div className="benchmark__protocol-label">
            <span>Evaluation frame</span>
            <strong>AMASS</strong>
          </div>
          <dl>
            <div>
              <dt>Protocol</dt>
              <dd>Aggregate sequences</dd>
            </div>
            <div>
              <dt>Reference field</dt>
              <dd>Published reference methods</dd>
            </div>
            <div>
              <dt>Named model</dt>
              <dd>CeRebel</dd>
            </div>
          </dl>
        </aside>

        <div className="benchmark__explorer">
          <div className="benchmark__explorer-head">
            <div>
              <span>AMASS / INTERACTIVE COMPARISON</span>
              <strong>
                <span>{overallLeader.method}</span> leads the listed field.
                <small>
                  {overallLeader.wins} of {benchmarkMetrics.length} metrics
                </small>
              </strong>
              <p>
                The field splits on head trajectory, not a blended score.
                T-head is plotted from zero so the gap stays in millimetres.
              </p>
            </div>
            <div className="benchmark__toggle" aria-label="Sequence length">
              {(["32", "128"] as const).map((length) => (
                <button
                  key={length}
                  type="button"
                  className={sequenceLength === length ? "is-active" : ""}
                  aria-pressed={sequenceLength === length}
                  onClick={() => setSequenceLength(length)}
                >
                  SEQ {length}
                </button>
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

          <div className="benchmark__pending">
            <span>CR</span>
            <div>
              <strong>CeRebel metadata</strong>
              <p>
                50.45M parameters, team-confirmed. FLOPs and comparable
                reference-model parameter counts remain locked.
              </p>
            </div>
            <i>50.45M PARAMS · FLOPs PENDING</i>
          </div>

          <details className="benchmark__source-view">
            <summary>
              <span>
                <small>Source table</small>
                View exact published values
              </span>
              <ArrowDown aria-hidden="true" />
            </summary>

            <table className="benchmark__table">
              <caption className="sr-only">
                Published AMASS body-estimation values for sequence length{" "}
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
                AMASS published comparison, including CeRebel. Values
                transcribed from the evaluation excerpt supplied by the Cerebel
                team.
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
          eyebrow="CeRebel motion representation"
          title="From movement signals to physical intelligence."
          copy="A real action is retained as a synchronized sequence, then made inspectable as body, hands, spatial context, and time—not reduced to a pose overlay."
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

        <ol className="technology__layers">
          {remainingLayers.map(([index, title, copy]) => (
            <li key={title}>
              <span>{index}</span>
              <strong>{title}</strong>
              <p>{copy}</p>
              <ArrowRight aria-hidden="true" />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Robotics() {
  const uses = [
    "Human demonstration datasets",
    "Robot imitation learning",
    "Manipulation-task collection",
    "Human-to-robot motion alignment",
    "Teleoperation data",
    "Real-world embodied AI research",
  ];

  return (
    <section className="section robotics" id="robotics">
      <div className="page-grid robotics__content">
        <SectionHeading
          eyebrow="Robotics + embodied AI"
          title="Teach machines through natural human demonstration."
          copy="Cerebel is designed to collect actions from the operator’s natural point of view and transform the body, hand, object, and temporal context into structured representations."
        />
        <div
          className="robotics__flow"
          aria-label="Transferable information flow"
        >
          <span>Human action</span>
          <ArrowRight aria-hidden="true" />
          <span>Body + hands</span>
          <ArrowRight aria-hidden="true" />
          <span>Object state</span>
          <ArrowRight aria-hidden="true" />
          <span>Action sequence</span>
        </div>
        <ul className="robotics__uses">
          {uses.map((use) => (
            <li key={use}>{use}</li>
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
          eyebrow="In the field"
          title="Humanoids, athletes, and the brands that train them."
          copy="The same wearable capture serves demonstration datasets and coaching — named partners appear only when they are real."
        />
        <WorldsBento />
      </div>
    </section>
  );
}

function PartnerSolutions() {
  return (
    <section className="section partners" id="partners">
      <div className="page-grid partners__grid">
        <SectionHeading
          eyebrow="Partner solutions"
          title="From concept to integrated wearable system."
          copy="Cerebel supports consumer, industrial, research, and action-sports partners across product, hardware, perception, and data infrastructure."
        />

        <div className="partners__capabilities">
          {partnerCapabilities.map((capability, index) => (
            <div key={capability}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{capability}</p>
            </div>
          ))}
        </div>

        <a className="button button--primary partners__cta" href="#demo">
          Discuss a Partnership
          <ArrowUpRight aria-hidden="true" />
        </a>
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
            Book a demo
          </p>
          <h2>Bring real-world human intelligence into your system.</h2>
          <p>
            Tell us what you are building. We can discuss capture requirements,
            research collaboration, product integration, or a custom wearable
            configuration.
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
          <a href="#evidence">Evidence</a>
          <a href="#benchmark">Benchmark</a>
          <a href="#field">Field</a>
          <a href="#company">Company</a>
          <a href="#technology">Technology</a>
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
