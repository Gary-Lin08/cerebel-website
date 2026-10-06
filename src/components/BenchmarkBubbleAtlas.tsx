import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { benchmarkMetrics, buildComparison, type BenchmarkAtlasReference } from "./benchmark-model";
export type { BenchmarkAtlasReference, BenchmarkAtlasRow } from "./benchmark-model";

interface BenchmarkBubbleAtlasProps {
  sequenceLength: "32" | "128";
  reference: BenchmarkAtlasReference;
  activeMethod: string;
  onMethodChange: (method: string) => void;
}

const jawSpring = { type: "spring", stiffness: 340, damping: 30, mass: 0.8 } as const;

function Reading({ value, decimals, enabled }: { value: number; decimals: number; enabled: boolean }) {
  const reduced = useReducedMotion();
  const reading = useMotionValue(value);
  const formatted = useTransform(reading, current => current.toFixed(decimals));
  useEffect(() => {
    const controls = animate(reading, value, { duration: enabled && !reduced ? 0.4 : 0, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, enabled, reduced, reading]);
  return <motion.span aria-hidden="true">{formatted}</motion.span>;
}

export function BenchmarkBubbleAtlas({ sequenceLength, reference, activeMethod, onMethodChange }: BenchmarkBubbleAtlasProps) {
  const [metricIndex, setMetricIndex] = useState(0);
  const metric = benchmarkMetrics[metricIndex];
  const rows = reference[sequenceLength];
  const comparison = useMemo(() => buildComparison(rows, metric), [rows, metric]);
  const selected = rows.find(row => row[0] === activeMethod) ?? rows[0];
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const reduced = useReducedMotion();
  const selectionId = useId();

  // The caliper: one jaw fixed on the leader, one the visitor drags to any other method.
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const dragging = useRef(false);
  const jaw = useMotionValue(0);
  const compared = comparison.ranked.find(row => row.method === selected[0]) ?? comparison.leader;
  const comparedIndex = comparison.ranked.indexOf(compared);
  const isLeader = compared.method === comparison.leader.method;
  const leaderX = (comparison.leader.value / comparison.scale) * trackWidth;
  const jawTarget = (compared.value / comparison.scale) * trackWidth;
  const difference = Math.abs(compared.value - comparison.leader.value);
  const unitLabel = metric.unit === "score" ? "points" : metric.unit;
  const bandLeft = useTransform(jaw, position => Math.min(position, leaderX));
  const bandWidth = useTransform(jaw, position => Math.abs(position - leaderX));

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(([entry]) => setTrackWidth(entry.contentRect.width));
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (dragging.current) return;
    const controls = animate(jaw, jawTarget, reduced ? { duration: 0 } : jawSpring);
    return () => controls.stop();
  }, [jaw, jawTarget, reduced]);

  const selectNearest = () => {
    if (!trackWidth) return;
    const value = (jaw.get() / trackWidth) * comparison.scale;
    const nearest = comparison.ranked.reduce((best, row) => (Math.abs(row.value - value) < Math.abs(best.value - value) ? row : best));
    if (nearest.method !== compared.method) onMethodChange(nearest.method);
  };

  const stepWithKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = comparison.ranked[Math.max(0, Math.min(comparison.ranked.length - 1, comparedIndex + step))];
    onMethodChange(next.method);
  };

  return (
    <figure ref={ref} className="benchmark-instrument" aria-label="AMASS metric comparison">
      <div className="benchmark-instrument__metrics" role="group" aria-label="Comparison metric">
        {benchmarkMetrics.map((item, index) => (
          <button key={item.label} type="button" aria-pressed={index === metricIndex} onClick={() => setMetricIndex(index)}>
            {index === metricIndex && <motion.span className="benchmark-instrument__selection" layoutId={`${selectionId}-metric`} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 36 }} />}
            <span>{item.label}</span><small>{item.direction === "lower" ? "↓" : "↑"}</small>
          </button>
        ))}
      </div>
      <div className="benchmark-instrument__body">
        <section className="benchmark-instrument__plot" aria-label={`${metric.label} comparison`}>
          <header className="benchmark-instrument__reading">
            <div>
              <p>{metric.title}</p>
              <h3 aria-label={`${comparison.leader.method}: ${comparison.leader.display} ${metric.unit}`}>
                <Reading value={comparison.leader.value} decimals={metric.decimals} enabled={inView} />
                <span>{metric.unit}</span>
              </h3>
              <span className="benchmark-instrument__leader"><i aria-hidden="true" />{comparison.leader.method} leads this comparison</span>
            </div>
            <p className="benchmark-instrument__direction">{metric.direction === "lower" ? "Shorter is better" : "Longer is better"}<span>Scale starts at zero</span></p>
          </header>
          <div className="benchmark-instrument__lanes">
            <div className="benchmark-instrument__grid" aria-hidden="true">
              {inView && !reduced && <motion.i initial={{ scaleX: 0, opacity: 0.6 }} animate={{ scaleX: 1, opacity: 0 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />}
            </div>
            {comparison.ranked.map((row, index) => (
              <motion.button
                // Rows glide to their new rank when the metric changes instead of swapping in place.
                layout="position"
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }}
                type="button"
                key={row.method}
                className={`benchmark-instrument__lane${selected[0] === row.method ? " is-selected" : ""}${row.method === comparison.leader.method ? " is-leader" : ""}`}
                aria-pressed={selected[0] === row.method}
                aria-label={`${row.method} ${metric.label} ${row.exact}`}
                onClick={() => onMethodChange(row.method)}
              >
                <span>{row.method}{row.method === comparison.leader.method && <i aria-label="Metric leader" />}</span>
                <span className="benchmark-instrument__track"><motion.i initial={false} animate={{ scaleX: inView || reduced ? row.value / comparison.scale : 0 }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 28, delay: index * 0.035 }} /></span>
                <b><Reading value={row.value} decimals={metric.decimals} enabled={inView} /></b>
              </motion.button>
            ))}
            <div className="benchmark-caliper" ref={trackRef}>
              <motion.span className="benchmark-caliper__band" style={{ x: bandLeft, width: bandWidth }} aria-hidden="true" />
              <motion.div
                className="benchmark-caliper__jaw"
                style={{ x: jaw }}
                drag="x"
                dragConstraints={{ left: 0, right: trackWidth }}
                dragElastic={0.06}
                dragMomentum={false}
                onDragStart={() => {
                  dragging.current = true;
                }}
                onDrag={selectNearest}
                onDragEnd={() => {
                  dragging.current = false;
                  // Settle on the method the jaw came nearest to.
                  animate(jaw, jawTarget, reduced ? { duration: 0 } : jawSpring);
                }}
                role="slider"
                tabIndex={0}
                aria-label="Compare a method with the leader"
                aria-valuemin={1}
                aria-valuemax={comparison.ranked.length}
                aria-valuenow={comparedIndex + 1}
                aria-valuetext={isLeader ? `${compared.method}, the leader` : `${compared.method}, ${difference.toFixed(metric.decimals)} ${unitLabel} from ${comparison.leader.method}`}
                onKeyDown={stepWithKeys}
              >
                <span className="benchmark-caliper__tag">
                  {isLeader ? (
                    <>Drag to compare <i aria-hidden="true">→</i></>
                  ) : (
                    <>
                      <strong>{compared.method}</strong>
                      {compared.value > comparison.leader.value ? "+" : "−"}
                      <Reading value={difference} decimals={metric.decimals} enabled />
                      <small>{unitLabel}</small>
                    </>
                  )}
                </span>
                <i className="benchmark-caliper__grip" aria-hidden="true" />
              </motion.div>
            </div>
          </div>
          <div className="benchmark-instrument__scale" aria-hidden="true"><span>0</span><span>{comparison.scale / 2}</span><span>{comparison.scale}</span></div>
          <p className="benchmark-instrument__gap">
            {isLeader
              ? `${comparison.gap.toFixed(metric.decimals)} ${unitLabel} separates ${comparison.leader.method} and ${comparison.next.method}.`
              : `${difference.toFixed(metric.decimals)} ${unitLabel} separates ${comparison.leader.method} and ${compared.method}.`}
          </p>
        </section>
        <aside className="benchmark-instrument__profile" aria-label={`Selected method profile: ${selected[0]}`}>
          <header><span>Selected method</span><h3>{selected[0]}</h3><p>Sequence length {sequenceLength}</p></header>
          <dl>{benchmarkMetrics.map(item => (
            <div key={item.label} className={item.label === metric.label ? "is-current" : ""}>
              <dt>{item.label}<span>{item.direction === "lower" ? "↓ lower" : "↑ higher"}</span></dt>
              <dd>{selected[item.index]}<small>{item.unit}</small></dd>
            </div>
          ))}</dl>
          <p>Values shown with their reported uncertainty.</p>
        </aside>
      </div>
      <figcaption><span><i className="is-leader" />Indigo · metric leader</span><span><i className="is-selected" />Purple · your selection</span><span>Drag the marker, or select a method, to inspect all four metrics.</span></figcaption>
    </figure>
  );
}
