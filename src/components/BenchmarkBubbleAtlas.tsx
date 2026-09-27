import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { benchmarkMetrics, buildComparison, type BenchmarkAtlasReference } from "./benchmark-model";
export type { BenchmarkAtlasReference, BenchmarkAtlasRow } from "./benchmark-model";

interface BenchmarkBubbleAtlasProps {
  sequenceLength: "32" | "128";
  reference: BenchmarkAtlasReference;
  activeMethod: string;
  onMethodChange: (method: string) => void;
}

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
  const leaderPercent = comparison.leader.value / comparison.scale * 100;
  const nextPercent = comparison.next.value / comparison.scale * 100;

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
              <span style={{ left: `${Math.min(leaderPercent, nextPercent)}%`, width: `${Math.abs(nextPercent - leaderPercent)}%` }} />
              {inView && !reduced && <motion.i initial={{ scaleX: 0, opacity: 0.6 }} animate={{ scaleX: 1, opacity: 0 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />}
            </div>
            {comparison.ranked.map((row, index) => (
              <button type="button" key={row.method} className={`benchmark-instrument__lane${selected[0] === row.method ? " is-selected" : ""}${row.method === comparison.leader.method ? " is-leader" : ""}`} aria-pressed={selected[0] === row.method} aria-label={`${row.method} ${metric.label} ${row.exact}`} onClick={() => onMethodChange(row.method)}>
                <span>{row.method}{row.method === comparison.leader.method && <i aria-label="Metric leader" />}</span>
                <span className="benchmark-instrument__track"><motion.i initial={false} animate={{ scaleX: inView || reduced ? row.value / comparison.scale : 0 }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 28, delay: index * 0.035 }} /></span>
                <b>{row.display}</b>
              </button>
            ))}
          </div>
          <div className="benchmark-instrument__scale" aria-hidden="true"><span>0</span><span>{comparison.scale / 2}</span><span>{comparison.scale}</span></div>
          <p className="benchmark-instrument__gap">{comparison.gap.toFixed(metric.decimals)} {metric.unit === "score" ? "points" : metric.unit} separates {comparison.leader.method} and {comparison.next.method}.</p>
        </section>
        <aside className="benchmark-instrument__profile" aria-label={`Selected method profile: ${selected[0]}`}>
          <header><span>Selected method</span><h3>{selected[0]}</h3><p>Sequence length {sequenceLength}</p></header>
          <dl>{benchmarkMetrics.map(item => (
            <div key={item.label} className={item.label === metric.label ? "is-current" : ""}>
              <dt>{item.label}<span>{item.direction === "lower" ? "↓ lower" : "↑ higher"}</span></dt>
              <dd>{selected[item.index]}<small>{item.unit}</small></dd>
            </div>
          ))}</dl>
          <p>Values and uncertainty as reported in the team-supplied evaluation.</p>
        </aside>
      </div>
      <figcaption><span><i className="is-leader" />Indigo · metric leader</span><span><i className="is-selected" />Purple · your selection</span><span>Select a method to inspect all four metrics.</span></figcaption>
    </figure>
  );
}
