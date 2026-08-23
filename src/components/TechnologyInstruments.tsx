import { ArrowCounterClockwise, Pause, Play } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { useCompact } from "../hooks";
import { NeuralHuman, type NeuralJoint } from "./NeuralHuman";

const FRAME_COUNT = 813;

const applicationModes = ["Demonstration", "Locomotion", "Interaction", "Performance"] as const;
const viewModes = ["Wearable view", "Body + hands", "Object context", "Temporal field"] as const;

const analysisPoints: Array<{ id: NeuralJoint; label: string; channel: string; cue: string }> = [
  { id: "rWrist", label: "Right wrist", channel: "hand–object", cue: "The hand path stays attached to the task and surrounding scene." },
  { id: "rElbow", label: "Right elbow", channel: "upper limb", cue: "The reach remains continuous across the recovered sequence." },
  { id: "chest", label: "Thorax", channel: "body orientation", cue: "Torso orientation anchors movement inside a full-body action." },
  { id: "lAnkle", label: "Left ankle", channel: "ground relation", cue: "Contact timing remains one part of the reconstructed motion." },
];

function formatTime(frame: number) {
  const seconds = (frame / FRAME_COUNT) * 24.4;
  return `00:${String(Math.floor(seconds)).padStart(2, "0")}.${Math.round((seconds % 1) * 10)}`;
}

export function TechnologyInstruments() {
  const reduceMotion = useReducedMotion();
  const compact = useCompact();
  const rangeId = useId();
  const [frame, setFrame] = useState(276);
  const [isPlaying, setIsPlaying] = useState(false);
  const [application, setApplication] = useState<(typeof applicationModes)[number]>("Interaction");
  const [view, setView] = useState<(typeof viewModes)[number]>("Body + hands");
  const [selectedJoint, setSelectedJoint] = useState<NeuralJoint>("rWrist");

  const point = analysisPoints.find((entry) => entry.id === selectedJoint) ?? analysisPoints[0];
  const relativeLoad = useMemo(
    () => 42 + Math.round(Math.abs(Math.sin(frame / 74 + analysisPoints.findIndex((entry) => entry.id === selectedJoint))) * 47),
    [frame, selectedJoint],
  );

  useEffect(() => {
    if (!isPlaying || reduceMotion || compact) return;
    const timer = window.setInterval(() => setFrame((current) => (current >= FRAME_COUNT ? 0 : current + 9)), 80);
    return () => window.clearInterval(timer);
  }, [compact, isPlaying, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || compact) setIsPlaying(false);
  }, [compact, reduceMotion]);

  const reset = () => {
    setFrame(276);
    setIsPlaying(false);
    setSelectedJoint("rWrist");
    setApplication("Interaction");
    setView("Body + hands");
  };

  return (
    <motion.section
      className="motion-lab"
      aria-label="Interactive motion analysis explorer"
      initial={reduceMotion || compact ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <header className="motion-lab__header">
        <div><span>Cerebel / motion lab</span><strong>INTERACTIVE KINEMATIC EXPLORER</strong></div>
        <p>Illustrative interaction view · not a validated force estimate</p>
      </header>

      <div className="motion-lab__applications" role="tablist" aria-label="Application states">
        {applicationModes.map((mode) => (
          <button key={mode} type="button" role="tab" aria-selected={mode === application} className={mode === application ? "is-active" : ""} onClick={() => setApplication(mode)}>{mode}</button>
        ))}
      </div>

      <div className="motion-lab__body">
        <div className="motion-lab__stage">
          <div className="motion-lab__stage-meta" aria-hidden="true"><span>{application} / {view}</span><span>Frame {String(frame).padStart(3, "0")} / {FRAME_COUNT}</span></div>
          <NeuralHuman live={false} frame={frame} selectedJoint={selectedJoint} />
          <div className="motion-lab__joint-label" aria-hidden="true"><i /><span>active point</span><strong>{point.label}</strong></div>
          <div className="motion-lab__axis" aria-hidden="true"><i>X</i><i>Y</i><i>Z</i></div>
        </div>

        <aside className="motion-lab__console">
          <div className="motion-lab__view-picker"><span>Observation mode</span><div role="tablist" aria-label="Observation mode">
            {viewModes.map((mode) => <button key={mode} type="button" role="tab" aria-selected={mode === view} className={mode === view ? "is-active" : ""} onClick={() => setView(mode)}>{mode}</button>)}
          </div></div>

          <div className="motion-lab__readout" aria-live="polite"><span>Sequence position</span><strong>{formatTime(frame)}</strong><small>same action · one timeline</small></div>

          <div className="motion-lab__scrub"><label htmlFor={rangeId}>Frame {String(frame).padStart(3, "0")}</label><input id={rangeId} type="range" min="0" max={FRAME_COUNT} value={frame} onChange={(event) => { setFrame(Number(event.target.value)); setIsPlaying(false); }} aria-valuetext={`Frame ${frame} at ${formatTime(frame)}`} /><div><span>00:00</span><span>00:24.4</span></div></div>

          <div className="motion-lab__transport"><button type="button" onClick={() => setIsPlaying((current) => !current)} disabled={reduceMotion || compact}>{isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{isPlaying ? "Pause sequence" : "Play sequence"}</button><button type="button" onClick={reset} aria-label="Reset motion explorer"><ArrowCounterClockwise aria-hidden="true" /></button></div>

          <div className="motion-lab__point-picker"><span>Analysis point</span><div>{analysisPoints.map((entry) => <button key={entry.id} type="button" className={entry.id === selectedJoint ? "is-active" : ""} onClick={() => setSelectedJoint(entry.id)}><i aria-hidden="true" />{entry.label}</button>)}</div></div>

          <div className="motion-lab__load"><div><span>Relative motion load</span><strong>{relativeLoad}<small>/ 100</small></strong></div><div className="motion-lab__meter" aria-label={`Relative motion load ${relativeLoad} out of 100`}><i style={{ "--load": `${relativeLoad}%` } as CSSProperties} /></div><p>{point.channel} · {point.cue}</p></div>
        </aside>
      </div>

      <footer className="motion-lab__footer"><span>Interactive analysis view</span><p>Switch application and observation modes, then scrub the time cursor to inspect one recovered action.</p><span>DEVELOPMENT VISUALIZATION</span></footer>
    </motion.section>
  );
}
