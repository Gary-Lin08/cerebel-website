import { useEffect, useRef } from "react";
import {
  createNeuralHumanState,
  drawNeuralHuman,
  tickNeuralHuman,
} from "./neural-human/engine";

export type NeuralJoint = "rWrist" | "rElbow" | "chest" | "lAnkle";

type NeuralHumanProps = {
  live: boolean;
  frame?: number;
  selectedJoint?: NeuralJoint;
};

export function NeuralHuman({ live, frame: analysisFrame, selectedJoint }: NeuralHumanProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = createNeuralHumanState();
    const pointerTarget = { x: 0, y: 0 };
    let width = 0;
    let height = 0;
    let frame = 0;
    let running = false;
    let start = 0;
    let last = 0;
    const hasAnalysisFrame = typeof analysisFrame === "number";
    let elapsed = hasAnalysisFrame ? (analysisFrame / 813) * 12.5 : live ? 0 : 12.5;

    const paint = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx || !width || !height) return;
      tickNeuralHuman(state, 0, elapsed, width, height, pointer.current, !live || hasAnalysisFrame);
      drawNeuralHuman(ctx, state, width, height, pointer.current, selectedJoint);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!running) paint();
    };

    const render = (now: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (!start) start = now;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      if (live && running && !hasAnalysisFrame) elapsed = (now - start) / 1000;

      pointer.current.x += (pointerTarget.x - pointer.current.x) * 0.08;
      pointer.current.y += (pointerTarget.y - pointer.current.y) * 0.08;

      tickNeuralHuman(state, dt, elapsed, width, height, pointer.current, !live || hasAnalysisFrame);
      drawNeuralHuman(ctx, state, width, height, pointer.current, selectedJoint);

      if (live && running && !hasAnalysisFrame) {
        frame = window.requestAnimationFrame(render);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerTarget.x = (event.clientX - rect.left) / rect.width - 0.5;
      pointerTarget.y = (event.clientY - rect.top) / rect.height - 0.5;
    };

    const onPointerLeave = () => {
      pointerTarget.x = 0;
      pointerTarget.y = 0;
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
        if (!running) {
          window.cancelAnimationFrame(frame);
          last = 0;
          return;
        }
        if (live && !hasAnalysisFrame) {
          start = 0;
          elapsed = 0;
          frame = window.requestAnimationFrame(render);
        }
      },
      { threshold: 0.35 },
    );

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    observer.observe(canvas);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      ro.disconnect();
      observer.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [analysisFrame, live, selectedJoint]);

  return <canvas ref={canvasRef} className="neural-human" />;
}
