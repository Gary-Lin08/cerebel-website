import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import "./electric-border.css";

interface ElectricBorderProps {
  children?: ReactNode;
  color?: string;
  speed?: number;
  chaos?: number;
  borderRadius?: number;
  className?: string;
  style?: CSSProperties;
  paused?: boolean;
}

// React Bits — Electric Border (TS/CSS variant), with a paused prop for
// Cerebel's reduced-motion treatment.
export default function ElectricBorder({
  children,
  color = "#5227FF",
  speed = 1,
  chaos = 0.12,
  borderRadius = 24,
  className,
  style,
  paused = false,
}: ElectricBorderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  const random = useCallback((value: number) => (Math.sin(value * 12.9898) * 43758.5453) % 1, []);

  const noise2D = useCallback(
    (x: number, y: number) => {
      const i = Math.floor(x);
      const j = Math.floor(y);
      const fx = x - i;
      const fy = y - j;
      const a = random(i + j * 57);
      const b = random(i + 1 + j * 57);
      const c = random(i + (j + 1) * 57);
      const d = random(i + 1 + (j + 1) * 57);
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);

      return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
    },
    [random],
  );

  const octavedNoise = useCallback(
    (x: number, time: number, seed: number) => {
      const octaves = 10;
      const lacunarity = 1.6;
      const gain = 0.7;
      let output = 0;
      let amplitude = chaos;
      let frequency = 10;

      for (let index = 0; index < octaves; index += 1) {
        const firstOctaveFlattening = index === 0 ? 0 : 1;
        output += amplitude * firstOctaveFlattening * noise2D(frequency * x + seed * 100, time * frequency * 0.3);
        frequency *= lacunarity;
        amplitude *= gain;
      }

      return output;
    },
    [chaos, noise2D],
  );

  const getCornerPoint = useCallback(
    (centerX: number, centerY: number, radius: number, startAngle: number, arcLength: number, progress: number) => {
      const angle = startAngle + progress * arcLength;
      return { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
    },
    [],
  );

  const getRoundedRectPoint = useCallback(
    (progress: number, left: number, top: number, width: number, height: number, radius: number) => {
      const straightWidth = width - 2 * radius;
      const straightHeight = height - 2 * radius;
      const cornerArc = (Math.PI * radius) / 2;
      const perimeter = 2 * straightWidth + 2 * straightHeight + 4 * cornerArc;
      const distance = progress * perimeter;
      let accumulated = 0;

      if (distance <= accumulated + straightWidth) {
        return { x: left + radius + ((distance - accumulated) / straightWidth) * straightWidth, y: top };
      }
      accumulated += straightWidth;
      if (distance <= accumulated + cornerArc) {
        return getCornerPoint(left + width - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2, (distance - accumulated) / cornerArc);
      }
      accumulated += cornerArc;
      if (distance <= accumulated + straightHeight) {
        return { x: left + width, y: top + radius + ((distance - accumulated) / straightHeight) * straightHeight };
      }
      accumulated += straightHeight;
      if (distance <= accumulated + cornerArc) {
        return getCornerPoint(left + width - radius, top + height - radius, radius, 0, Math.PI / 2, (distance - accumulated) / cornerArc);
      }
      accumulated += cornerArc;
      if (distance <= accumulated + straightWidth) {
        return { x: left + width - radius - ((distance - accumulated) / straightWidth) * straightWidth, y: top + height };
      }
      accumulated += straightWidth;
      if (distance <= accumulated + cornerArc) {
        return getCornerPoint(left + radius, top + height - radius, radius, Math.PI / 2, Math.PI / 2, (distance - accumulated) / cornerArc);
      }
      accumulated += cornerArc;
      if (distance <= accumulated + straightHeight) {
        return { x: left, y: top + height - radius - ((distance - accumulated) / straightHeight) * straightHeight };
      }
      accumulated += straightHeight;
      return getCornerPoint(left + radius, top + radius, radius, Math.PI, Math.PI / 2, (distance - accumulated) / cornerArc);
    },
    [getCornerPoint],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || paused) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const borderOffset = 60;
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width + borderOffset * 2;
      const height = rect.height + borderOffset * 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width, height };
    };

    let { width, height } = updateSize();
    let lastDpr = Math.min(window.devicePixelRatio || 1, 2);

    const draw = (currentTime: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (dpr !== lastDpr) {
        lastDpr = dpr;
        ({ width, height } = updateSize());
      }

      timeRef.current += ((currentTime - lastFrameTimeRef.current) / 1000) * speed;
      lastFrameTimeRef.current = currentTime;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.lineCap = "round";
      context.lineJoin = "round";

      const left = borderOffset;
      const top = borderOffset;
      const borderWidth = width - borderOffset * 2;
      const borderHeight = height - borderOffset * 2;
      const radius = Math.min(borderRadius, Math.min(borderWidth, borderHeight) / 2);
      const sampleCount = Math.floor((2 * (borderWidth + borderHeight) + 2 * Math.PI * radius) / 2);
      context.beginPath();

      for (let index = 0; index <= sampleCount; index += 1) {
        const progress = index / sampleCount;
        const point = getRoundedRectPoint(progress, left, top, borderWidth, borderHeight, radius);
        const x = point.x + octavedNoise(progress * 8, timeRef.current, 0) * 60;
        const y = point.y + octavedNoise(progress * 8, timeRef.current, 1) * 60;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }

      context.closePath();
      context.stroke();
      animationRef.current = requestAnimationFrame(draw);
    };

    const resizeObserver = new ResizeObserver(() => {
      ({ width, height } = updateSize());
    });
    resizeObserver.observe(container);
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
    };
  }, [borderRadius, color, getRoundedRectPoint, octavedNoise, paused, speed]);

  return (
    <div
      ref={containerRef}
      className={`rb-electric-border ${className ?? ""}`}
      style={{ "--electric-border-color": color, borderRadius, ...style } as CSSProperties}
    >
      <div className="rb-electric-border__canvas" aria-hidden="true">
        <canvas ref={canvasRef} />
      </div>
      <div className="rb-electric-border__layers" aria-hidden="true">
        <div className="rb-electric-border__glow rb-electric-border__glow--near" />
        <div className="rb-electric-border__glow rb-electric-border__glow--far" />
        <div className="rb-electric-border__ambient" />
      </div>
      <div className="rb-electric-border__content">{children}</div>
    </div>
  );
}
