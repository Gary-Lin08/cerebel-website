import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useCompact } from "../hooks";

type SequenceSet = {
  width: number;
  height: number;
  logicalStep?: number;
  paths: string[];
  totalBytes: number;
};

type SequenceManifest = {
  format: "cerebel-scroll-sequence-v1";
  logicalFrameCount: number;
  posterFrame: number;
  reducedMotionFrame: number;
  phaseBoundaries: number[];
  desktop: SequenceSet;
  mobile: SequenceSet;
};

type CachedFrame = {
  source: ImageBitmap | HTMLImageElement;
  usedAt: number;
};

const manifestUrl = "/media/cerebel-scroll/manifest.json";
const assetBase = (import.meta.env.VITE_CEREBEL_SCROLL_ASSET_BASE_URL ?? "").replace(/\/$/, "");

const phases = [
  {
    label: "AR concept",
    title: "Information. In your line of sight.",
    copy: "Designed for in-lens AR. A development concept exploring how information could enter your line of sight.",
  },
  {
    label: "Capture",
    title: "Your perspective. Captured.",
    copy: "Designed for camera and sensor capture from a wearable perspective. Functional integration is in development.",
  },
  {
    label: "One wearable",
    title: "Display and capture. Together.",
    copy: "Our goal: bring in-lens display and multimodal capture into one wearable. This visualization shows the intended architecture.",
  },
  {
    label: "Inside out",
    title: "One system. Every layer visible.",
    copy: "The exploded development view separates the major structural modules without presenting a finalized production specification.",
  },
] as const;

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function resolveAssetPath(value: string) {
  return assetBase ? `${assetBase}${value}` : value;
}

function closeFrame(frame: CachedFrame) {
  if ("close" in frame.source && typeof frame.source.close === "function") {
    frame.source.close();
  }
}

async function decodeFrame(url: string, signal: AbortSignal): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    const response = await fetch(url, { cache: "force-cache", signal });
    if (!response.ok) throw new Error(`Frame request failed with ${response.status}.`);
    return createImageBitmap(await response.blob());
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Frame could not be decoded."));
    image.src = url;
  });
}

export function LegacyCerebelScrollSequence() {
  const sectionRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameLabelRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const compact = useCompact("(max-width: 760px)");
  const reduceMotion = Boolean(useReducedMotion());
  const [phase, setPhase] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (reduceMotion) setPhase(2);
  }, [reduceMotion]);

  useEffect(() => {
    const section = sectionRef.current;
    const media = mediaRef.current;
    const canvas = canvasRef.current;
    if (!section || !media || !canvas) return;

    const controller = new AbortController();
    let disposed = false;
    let started = false;
    let scrollFrame = 0;
    let targetIndex = 0;
    let lastLogicalFrame = 0;
    let lastProgress = 0;
    let manifest: SequenceManifest | null = null;
    let sequence: SequenceSet | null = null;
    let visible = true;
    let hasRenderedFrame = false;
    let decodeCount = 0;
    const cache = new Map<number, CachedFrame>();
    const queued = new Set<number>();
    const queue: number[] = [];
    const maximumCachedFrames = compact ? 30 : 48;
    const maximumConcurrentRequests = compact ? 3 : 5;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const resizeCanvas = () => {
      const bounds = media.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.5);
      canvas.width = Math.max(1, Math.round(bounds.width * pixelRatio));
      canvas.height = Math.max(1, Math.round(bounds.height * pixelRatio));
      canvas.style.width = `${bounds.width}px`;
      canvas.style.height = `${bounds.height}px`;
      drawClosest();
    };

    const drawSource = (source: ImageBitmap | HTMLImageElement) => {
      const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
      const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
      const scale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
      const width = sourceWidth * scale;
      const height = sourceHeight * scale;
      const x = (canvas.width - width) / 2;
      const y = (canvas.height - height) / 2;
      context.fillStyle = "#bebebe";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, x, y, width, height);
    };

    function drawClosest() {
      if (!cache.size) return;
      let closestIndex = -1;
      let closestDistance = Number.POSITIVE_INFINITY;
      for (const index of cache.keys()) {
        const distance = Math.abs(index - targetIndex);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      }
      const frame = cache.get(closestIndex);
      if (!frame) return;
      frame.usedAt = performance.now();
      drawSource(frame.source);
      if (!hasRenderedFrame) {
        hasRenderedFrame = true;
        setStatus("ready");
      }
    }

    const evictFrames = () => {
      if (cache.size <= maximumCachedFrames) return;
      const candidates = [...cache.entries()]
        .filter(([index]) => Math.abs(index - targetIndex) > 8)
        .sort((a, b) => {
          const distance = Math.abs(b[0] - targetIndex) - Math.abs(a[0] - targetIndex);
          return distance || a[1].usedAt - b[1].usedAt;
        });
      while (cache.size > maximumCachedFrames && candidates.length) {
        const [index, frame] = candidates.shift()!;
        closeFrame(frame);
        cache.delete(index);
      }
    };

    const pumpQueue = () => {
      if (!sequence || disposed) return;
      while (decodeCount < maximumConcurrentRequests && queue.length) {
        const index = queue.shift()!;
        queued.delete(index);
        if (cache.has(index)) continue;
        decodeCount += 1;
        void decodeFrame(resolveAssetPath(sequence.paths[index]), controller.signal)
          .then((source) => {
            if (disposed) {
              if ("close" in source && typeof source.close === "function") source.close();
              return;
            }
            cache.set(index, { source, usedAt: performance.now() });
            evictFrames();
            if (index === targetIndex || cache.size === 1) drawClosest();
          })
          .catch((error: unknown) => {
            if (!controller.signal.aborted) {
              console.warn("Cerebel scroll frame could not be loaded.", error);
              if (!cache.size) setStatus("error");
            }
          })
          .finally(() => {
            decodeCount -= 1;
            pumpQueue();
          });
      }
    };

    const enqueue = (index: number, priority = false) => {
      if (!sequence || index < 0 || index >= sequence.paths.length || cache.has(index) || queued.has(index)) return;
      queued.add(index);
      if (priority) queue.unshift(index);
      else queue.push(index);
    };

    const prefetchAround = (index: number, direction: number) => {
      enqueue(index, true);
      for (let offset = 1; offset <= 10; offset += 1) {
        enqueue(index + offset, true);
        enqueue(index - offset, true);
      }
      for (let offset = 11; offset <= (compact ? 20 : 34); offset += 1) {
        enqueue(index + offset * direction);
      }
      pumpQueue();
    };

    const phaseForFrame = (frame: number) => {
      if (frame < 120) return 0;
      if (frame < 260) return 1;
      if (frame < 360) return 2;
      return 3;
    };

    const renderForScroll = () => {
      scrollFrame = 0;
      if (!manifest || !sequence || reduceMotion) return;
      const bounds = section.getBoundingClientRect();
      const travel = Math.max(1, bounds.height - window.innerHeight);
      const progress = clamp(-bounds.top / travel);
      const logicalFrame = Math.round(progress * (manifest.logicalFrameCount - 1));
      const nextPhase = phaseForFrame(logicalFrame);
      const direction = progress >= lastProgress ? 1 : -1;
      lastProgress = progress;
      if (nextPhase !== phaseForFrame(lastLogicalFrame)) setPhase(nextPhase);
      lastLogicalFrame = logicalFrame;
      const logicalStep = sequence.logicalStep ?? 1;
      targetIndex = Math.min(sequence.paths.length - 1, Math.floor(logicalFrame / logicalStep));
      if (frameLabelRef.current) frameLabelRef.current.textContent = String(logicalFrame + 1).padStart(3, "0");
      progressRef.current?.style.setProperty("--sequence-progress", `${progress}`);
      prefetchAround(targetIndex, direction);
      drawClosest();
    };

    const scheduleScrollRender = () => {
      if (!scrollFrame && visible) scrollFrame = window.requestAnimationFrame(renderForScroll);
    };

    const start = async () => {
      if (started) return;
      started = true;
      setStatus("loading");
      try {
        const response = await fetch(resolveAssetPath(manifestUrl), {
          cache: "force-cache",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Sequence manifest failed with ${response.status}.`);
        manifest = await response.json() as SequenceManifest;
        sequence = compact ? manifest.mobile : manifest.desktop;
        const logicalFrame = reduceMotion ? manifest.reducedMotionFrame - 1 : 0;
        const logicalStep = sequence.logicalStep ?? 1;
        targetIndex = Math.floor(logicalFrame / logicalStep);
        enqueue(targetIndex, true);
        for (let index = 1; index <= (compact ? 10 : 18); index += 1) enqueue(targetIndex + index);
        pumpQueue();
        if (!reduceMotion) scheduleScrollRender();
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("Cerebel scroll sequence could not be prepared.", error);
          setStatus("error");
        }
      }
    };

    const approachObserver = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void start();
    }, { rootMargin: "1400px 0px" });
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) scheduleScrollRender();
    }, { rootMargin: "120px 0px" });
    const resizeObserver = new ResizeObserver(resizeCanvas);

    approachObserver.observe(section);
    visibilityObserver.observe(section);
    resizeObserver.observe(media);
    resizeCanvas();
    window.addEventListener("scroll", scheduleScrollRender, { passive: true });
    window.addEventListener("resize", scheduleScrollRender);

    return () => {
      disposed = true;
      controller.abort();
      approachObserver.disconnect();
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("scroll", scheduleScrollRender);
      window.removeEventListener("resize", scheduleScrollRender);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      cache.forEach(closeFrame);
      cache.clear();
    };
  }, [compact, reduceMotion]);

  const jumpToPhase = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const phaseProgress = [0, 0.24, 0.51, 0.71][index] ?? 0;
    const travel = Math.max(0, section.offsetHeight - window.innerHeight);
    window.scrollTo({
      top: section.offsetTop + travel * phaseProgress,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <section
      id="wearable"
      ref={sectionRef}
      className={`product-sequence product-sequence--${status}${reduceMotion ? " is-reduced" : ""}`}
      aria-label="Cerebel wearable system product sequence"
    >
      <div className="product-sequence__sticky">
        <div className="product-sequence__identity">
          <strong>Cerebel glasses</strong>
          <span>Concept · In development</span>
        </div>
        <div ref={mediaRef} className="product-sequence__media">
          <picture className="product-sequence__poster">
            <source media="(max-width: 760px)" srcSet={reduceMotion ? "/media/cerebel-scroll/mobile/frame_0359.webp" : "/media/cerebel-scroll/mobile/frame_0001.webp"} />
            <img
              src={reduceMotion ? "/media/cerebel-scroll/desktop/frame_0360.webp" : "/media/cerebel-scroll/desktop/frame_0001.webp"}
              alt="Conceptual Cerebel wearable development configuration."
              loading="lazy"
              decoding="async"
            />
          </picture>
          <canvas ref={canvasRef} aria-hidden="true" />
        </div>

        <div className="product-sequence__copy" aria-live="polite">
          {phases.map((item, index) => (
            <div key={item.label} className={phase === index ? "is-active" : ""} aria-hidden={phase !== index}>
              <p>{String(index + 1).padStart(2, "0")} / {item.label}</p>
              <h2>{item.title}</h2>
              <span>{item.copy}</span>
            </div>
          ))}
        </div>

        <a className="product-sequence__evidence-link" href="#evidence">Explore research evidence <span aria-hidden="true">↗</span></a>
        {status === "error" ? <p className="product-sequence__fallback-note">Product sequence unavailable. Static view shown.</p> : null}
      </div>
    </section>
  );
}
