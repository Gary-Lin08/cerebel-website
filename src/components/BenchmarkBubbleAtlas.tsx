import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { LockSimple } from "@phosphor-icons/react/LockSimple";
import { X } from "@phosphor-icons/react/X";
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

export type BenchmarkAtlasRow = readonly [
  method: string,
  mpjpe: string,
  paMpjpe: string,
  gnd: string,
  head: string,
];

export interface BenchmarkAtlasReference {
  readonly "32": readonly BenchmarkAtlasRow[];
  readonly "128": readonly BenchmarkAtlasRow[];
}

interface BenchmarkBubbleAtlasProps {
  sequenceLength: "32" | "128";
  reference: BenchmarkAtlasReference;
  activeMethod: string;
  onMethodChange: (method: string) => void;
}

interface MetricDefinition {
  label: string;
  valueIndex: 1 | 2 | 3 | 4;
  direction: "lower" | "higher";
  unit: string;
}

interface TapeLane {
  row: BenchmarkAtlasRow;
  method: string;
  mean: number;
  display: string;
}

const metricDefinitions: readonly MetricDefinition[] = [
  { label: "MPJPE", valueIndex: 1, direction: "lower", unit: "mm" },
  { label: "PA-MPJPE", valueIndex: 2, direction: "lower", unit: "mm" },
  { label: "GND", valueIndex: 3, direction: "higher", unit: "score" },
  { label: "T-head", valueIndex: 4, direction: "lower", unit: "mm" },
];

const radarAxes = [
  "MPJPE",
  "PA-MPJPE",
  "GND",
  "T-head",
  "Cross-seq",
  "Precision",
] as const;

const poseMetric = metricDefinitions[0];
const trajectoryMetric = metricDefinitions[3];

function parseMeasurement(value: string) {
  const [mean, deviation = "0"] = value.split("±");
  return {
    mean: Number.parseFloat(mean),
    deviation: Number.parseFloat(deviation),
  };
}

function formatTick(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function normalizedMetric(
  row: BenchmarkAtlasRow,
  rows: readonly BenchmarkAtlasRow[],
  metric: MetricDefinition,
) {
  const values = rows.map(
    (candidate) => parseMeasurement(candidate[metric.valueIndex]).mean,
  );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const current = parseMeasurement(row[metric.valueIndex]).mean;
  if (min === max) return 1;
  const normalized = (current - min) / (max - min);
  return metric.direction === "lower" ? 1 - normalized : normalized;
}

function relativeUncertainty(row: BenchmarkAtlasRow) {
  return (
    metricDefinitions.reduce((total, metric) => {
      const { mean, deviation } = parseMeasurement(row[metric.valueIndex]);
      return total + deviation / Math.max(Math.abs(mean), 0.001);
    }, 0) / metricDefinitions.length
  );
}

function crossSequenceStability(
  method: string,
  reference: BenchmarkAtlasReference,
) {
  const row32 =
    reference["32"].find(([name]) => name === method) ?? reference["32"][0];
  const row128 =
    reference["128"].find(([name]) => name === method) ?? reference["128"][0];
  return (
    1 -
    Math.abs(
      normalizedMetric(row32, reference["32"], poseMetric) -
        normalizedMetric(row128, reference["128"], poseMetric),
    )
  );
}

function polarPoint(
  centerX: number,
  centerY: number,
  radius: number,
  index: number,
  count: number,
) {
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  return [
    centerX + Math.cos(angle) * radius,
    centerY + Math.sin(angle) * radius,
  ] as const;
}

function polygonPoints(
  values: readonly number[],
  centerX: number,
  centerY: number,
  radius: number,
) {
  return values
    .map((value, index) => {
      const [x, y] = polarPoint(
        centerX,
        centerY,
        radius * Math.max(0.08, value),
        index,
        values.length,
      );
      return `${x},${y}`;
    })
    .join(" ");
}

function buildTape(
  rows: readonly BenchmarkAtlasRow[],
  metric: MetricDefinition,
) {
  const lanes: TapeLane[] = rows.map((row) => {
    const { mean } = parseMeasurement(row[metric.valueIndex]);
    return {
      row,
      method: row[0],
      mean,
      display: row[metric.valueIndex],
    };
  });
  const ranked = [...lanes].sort((a, b) =>
    metric.direction === "lower" ? a.mean - b.mean : b.mean - a.mean,
  );
  const max = Math.max(...lanes.map((lane) => lane.mean));
  const scaleMax =
    metric.direction === "higher" ? Math.max(1, max) : max * 1.04;
  const leader = ranked[0];
  const next = ranked[1];
  const ratio =
    metric.direction === "lower" && leader.mean > 0
      ? next.mean / leader.mean
      : null;

  return { lanes: ranked, scaleMax, leader, next, ratio };
}

function CountUp({
  value,
  enabled,
}: {
  value: number;
  enabled: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState(() => formatTick(value));

  useEffect(() => {
    if (!enabled || reduceMotion) {
      setText(formatTick(value));
      return;
    }

    const controls = animate(0, value, {
      duration: 1.05,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setText(formatTick(latest)),
    });
    return () => controls.stop();
  }, [enabled, reduceMotion, value]);

  return <b>{text}</b>;
}

function MetricTape({
  metric,
  tape,
  activeMethod,
  hero = false,
  play,
  delayBase = 0,
  sequenceKey,
  onSelect,
}: {
  metric: MetricDefinition;
  tape: ReturnType<typeof buildTape>;
  activeMethod: string;
  hero?: boolean;
  play: boolean;
  delayBase?: number;
  sequenceKey: string;
  onSelect: (method: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const shown = Boolean(reduceMotion || play);
  const leaderPct = (tape.leader.mean / tape.scaleMax) * 100;
  const nextPct = (tape.next.mean / tape.scaleMax) * 100;
  const ticks = [0, tape.scaleMax / 2, tape.scaleMax];
  const spring = {
    type: "spring" as const,
    stiffness: 160,
    damping: 22,
    mass: 0.55,
  };

  return (
    <div
      className={`metric-tape ${hero ? "is-hero" : ""}`}
      aria-label={`${metric.label} published comparison`}
    >
      <div className="metric-tape__head">
        <div>
          <span>
            {metric.label}
            {metric.unit ? ` / ${metric.unit}` : ""}
          </span>
          <strong>
            {metric.direction === "lower"
              ? "Bar length is the published error · shorter is better"
              : "Bar length is the published score · longer is better"}
          </strong>
        </div>
        {hero && tape.ratio ? (
          <p>
            <CountUp value={tape.leader.mean} enabled={shown} />
            <span>
              {tape.leader.method} · {formatTick(tape.ratio)}× below{" "}
              {tape.next.method}
            </span>
          </p>
        ) : null}
      </div>

      <div className="metric-tape__field">
        <div className="metric-tape__overlay" aria-hidden="true">
          {metric.direction === "lower" ? (
            <motion.i
              className="metric-tape__gap"
              initial={false}
              animate={{ opacity: shown ? 1 : 0 }}
              transition={{
                duration: 0.45,
                delay: reduceMotion ? 0 : delayBase + 0.55,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                left: `${leaderPct}%`,
                width: `${Math.max(0, nextPct - leaderPct)}%`,
              }}
            />
          ) : null}
          <motion.i
            className="metric-tape__leader-line"
            initial={false}
            animate={{ scaleY: shown ? 1 : 0 }}
            transition={{
              ...spring,
              delay: reduceMotion ? 0 : delayBase + 0.18,
            }}
            style={{
              left: `${leaderPct}%`,
              transformOrigin: "top center",
            }}
          />
          {hero && shown && !reduceMotion ? (
            <motion.i
              key={`scan-${sequenceKey}`}
              className="metric-tape__scan"
              initial={{ left: "0%" }}
              animate={{ left: "100%" }}
              transition={{
                duration: 0.95,
                ease: [0.22, 1, 0.36, 1],
                delay: delayBase,
              }}
            />
          ) : null}
        </div>

        {tape.lanes.map((lane, index) => {
          const isActive = lane.method === activeMethod;
          const isLeader = lane.method === tape.leader.method;
          return (
            <button
              key={`${metric.label}-${lane.method}`}
              type="button"
              className={`metric-tape__lane ${isActive ? "is-active" : ""} ${
                isLeader ? "is-leader" : ""
              }`}
              aria-pressed={isActive}
              aria-label={`${lane.method} ${metric.label} ${lane.display}`}
              onClick={() => onSelect(lane.method)}
            >
              <span className="metric-tape__name">{lane.method}</span>
              <span className="metric-tape__track">
                <motion.i
                  key={`${sequenceKey}-${lane.method}`}
                  className="metric-tape__bar"
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  animate={{ scaleX: shown ? 1 : 0 }}
                  transition={{
                    ...spring,
                    delay: reduceMotion ? 0 : delayBase + index * 0.07,
                  }}
                  style={{ width: `${(lane.mean / tape.scaleMax) * 100}%` }}
                />
              </span>
              <b className="metric-tape__value">{formatTick(lane.mean)}</b>
            </button>
          );
        })}
      </div>

      <div className="metric-tape__scale" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick}>{formatTick(tick)}</span>
        ))}
      </div>
    </div>
  );
}

export function BenchmarkBubbleAtlas({
  sequenceLength,
  reference,
  activeMethod,
  onMethodChange,
}: BenchmarkBubbleAtlasProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const tapeRef = useRef<HTMLElement>(null);
  const inView = useInView(tapeRef, { once: true, amount: 0.32 });
  const rows = reference[sequenceLength];

  const methods = useMemo(
    () =>
      rows.map((row) => ({
        row,
        method: row[0],
        crossSequence: crossSequenceStability(row[0], reference),
        uncertainty: relativeUncertainty(row),
      })),
    [reference, rows],
  );

  const headTape = useMemo(
    () => buildTape(rows, trajectoryMetric),
    [rows],
  );
  const supportTapes = useMemo(
    () =>
      metricDefinitions
        .filter((metric) => metric.label !== trajectoryMetric.label)
        .map((metric) => ({ metric, tape: buildTape(rows, metric) })),
    [rows],
  );

  const active =
    methods.find(({ method }) => method === activeMethod) ?? methods[0];
  const activeIndex = methods.findIndex(
    ({ method }) => method === active.method,
  );
  const precisionValues = methods.map(({ uncertainty }) => uncertainty);
  const precisionMin = Math.min(...precisionValues);
  const precisionMax = Math.max(...precisionValues);
  const precision =
    precisionMax === precisionMin
      ? 1
      : 1 -
        (active.uncertainty - precisionMin) / (precisionMax - precisionMin);
  const radarValues = [
    ...metricDefinitions.map((metric) =>
      normalizedMetric(active.row, rows, metric),
    ),
    active.crossSequence,
    precision,
  ];
  const poseLeader = rows.reduce((best, row) =>
    parseMeasurement(row[poseMetric.valueIndex]).mean <
    parseMeasurement(best[poseMetric.valueIndex]).mean
      ? row
      : best,
  );
  const trajectoryLeader = rows.reduce((best, row) =>
    parseMeasurement(row[trajectoryMetric.valueIndex]).mean <
    parseMeasurement(best[trajectoryMetric.valueIndex]).mean
      ? row
      : best,
  );
  const fieldBadge =
    active.method === poseLeader[0] && active.method === trajectoryLeader[0]
      ? "LEADS FIELD"
      : active.method === poseLeader[0]
        ? "LEADS MPJPE"
        : active.method === trajectoryLeader[0]
          ? "LEADS T-HEAD"
          : "PUBLISHED";

  const selectMethod = (method: string) => {
    onMethodChange(method);
    setProfileOpen(true);
  };

  const moveSelection = (direction: -1 | 1) => {
    const nextIndex =
      (activeIndex + direction + methods.length) % methods.length;
    selectMethod(methods[nextIndex].method);
  };

  return (
    <figure ref={tapeRef} className="bubble-atlas">
      <div className="bubble-atlas__main">
        <section
          className="bubble-atlas__plot"
          aria-label="Published AMASS method comparison"
        >
          <div className="bubble-atlas__plot-head">
            <div>
              <span>Primary instrument / T-head</span>
              <strong>Head-trajectory error on a real millimetre scale</strong>
            </div>
            <p>
              Four methods. One gap.
              <span>Supporting tracks keep the closer joint-error race honest</span>
            </p>
          </div>

          <MetricTape
            metric={trajectoryMetric}
            tape={headTape}
            activeMethod={active.method}
            hero
            play={inView}
            sequenceKey={sequenceLength}
            onSelect={selectMethod}
          />

          <div className="metric-tape-stack">
            {supportTapes.map(({ metric, tape }, index) => (
              <MetricTape
                key={metric.label}
                metric={metric}
                tape={tape}
                activeMethod={active.method}
                play={inView}
                delayBase={0.42 + index * 0.08}
                sequenceKey={sequenceLength}
                onSelect={selectMethod}
              />
            ))}
          </div>

          <div className="bubble-atlas__legend">
            <span>
              <i className="bubble-atlas__legend-dot" />
              Indigo = leader on that metric
            </span>
            <span>
              <i className="bubble-atlas__legend-ring" />
              Purple = current selection
            </span>
          </div>
        </section>

        <aside
          className={`bubble-atlas__profile ${
            profileOpen ? "is-open" : ""
          }`}
          aria-label={`Selected method profile: ${active.method}`}
        >
          <button
            type="button"
            className="bubble-atlas__profile-close"
            onClick={() => setProfileOpen(false)}
            aria-label="Close selected method profile"
          >
            Close
            <X aria-hidden="true" />
          </button>

          <div className="bubble-atlas__profile-head">
            <span>Selected method</span>
            <div>
              <strong>{active.method}</strong>
              <small>{fieldBadge}</small>
            </div>
            <p>Complete normalized profile / SEQ {sequenceLength}</p>
          </div>

          <div className="bubble-atlas__radar">
            <span>Six-axis performance profile</span>
            <svg
              viewBox="0 0 360 320"
              role="img"
              aria-label={`${active.method} normalized six-axis performance profile`}
            >
              {[0.28, 0.52, 0.76].map((scale) => (
                <polygon
                  key={scale}
                  className="bubble-atlas__radar-grid"
                  points={polygonPoints(
                    radarAxes.map(() => scale),
                    180,
                    154,
                    106,
                  )}
                />
              ))}
              {radarAxes.map((_, index) => {
                const [x, y] = polarPoint(
                  180,
                  154,
                  106,
                  index,
                  radarAxes.length,
                );
                return (
                  <line
                    key={index}
                    className="bubble-atlas__radar-axis"
                    x1="180"
                    y1="154"
                    x2={x}
                    y2={y}
                  />
                );
              })}
              <polygon
                className="bubble-atlas__radar-shape"
                points={polygonPoints(radarValues, 180, 154, 106)}
              />
              {radarValues.map((value, index) => {
                const [x, y] = polarPoint(
                  180,
                  154,
                  106 * Math.max(0.08, value),
                  index,
                  radarValues.length,
                );
                return (
                  <circle
                    key={radarAxes[index]}
                    className="bubble-atlas__radar-point"
                    cx={x}
                    cy={y}
                    r="3"
                  />
                );
              })}
              {radarAxes.map((label, index) => {
                const [x, y] = polarPoint(
                  180,
                  154,
                  136,
                  index,
                  radarAxes.length,
                );
                return (
                  <text
                    key={label}
                    className="bubble-atlas__radar-label"
                    x={x}
                    y={y}
                    textAnchor={
                      x < 150 ? "end" : x > 210 ? "start" : "middle"
                    }
                  >
                    {label}
                  </text>
                );
              })}
            </svg>
          </div>

          <div className="bubble-atlas__exact">
            <span>Exact published metrics</span>
            {metricDefinitions.map((metric) => (
              <div key={metric.label}>
                <strong>{metric.label}</strong>
                <small>
                  {metric.direction === "lower" ? "↓ lower" : "↑ higher"}
                </small>
                <b>{active.row[metric.valueIndex]}</b>
              </div>
            ))}
          </div>

          <div className="bubble-atlas__profile-nav">
            <button type="button" onClick={() => moveSelection(-1)}>
              <ArrowLeft aria-hidden="true" />
              Previous
            </button>
            <span>
              {String(activeIndex + 1).padStart(2, "0")} /{" "}
              {String(methods.length).padStart(2, "0")}
            </span>
            <button type="button" onClick={() => moveSelection(1)}>
              Next
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </aside>
      </div>

      <div className="bubble-atlas__mobile-selection">
        <span>
          Selected / <strong>{active.method}</strong>
        </span>
        <b>{active.row[4]}</b>
        <button type="button" onClick={() => setProfileOpen(true)}>
          View 6-axis profile
          <ArrowRight aria-hidden="true" />
        </button>
      </div>

      <div className="bubble-atlas__encoding">
        <div>
          <span>Encoding</span>
          <p>
            <i className="bubble-atlas__legend-dot" />
            Bar = published value from zero
          </p>
          <p>
            <i className="bubble-atlas__legend-ring" />
            Tint = gap from leader to next
          </p>
        </div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="CeRebel model: 50.45 million parameters, team confirmed. FLOPs and reference-model parameter counts are pending."
        >
          <LockSimple aria-hidden="true" />
          <span>
            CeRebel model
            <b>50.45M parameters</b>
            <small>VERIFIED / FLOPs PENDING</small>
          </span>
        </button>
      </div>

      <figcaption>
        <strong>Source / caveat</strong>
        <p>
          The primary tape plots published T-head on a real millimetre scale
          from zero, so a 6 mm result and a 45 mm result occupy different
          amounts of track. Supporting tapes use the same encoding for MPJPE,
          PA-MPJPE, and GND. CeRebel has 50.45M parameters (team-confirmed);
          parameter-size and FLOP encodings remain disabled until comparable
          reference-model values are verified.
        </p>
      </figcaption>
    </figure>
  );
}
