import { useEffect, useRef, type PointerEvent } from "react";

type FieldCell = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  glyph: string;
  phase: number;
};

type PointerState = {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  down: boolean;
};

const glyphs = "···..:;+=*#";
const fieldTerms = ["PHYSICAL AI", "PINN", "CFD", "BODY FIELD", "∇"];

/**
 * A deliberately lightweight canvas field: each glyph acts as a spring that can
 * be disturbed by a pointer drag, then returns to its sampled flow position.
 */
export function LiquidAsciiField({ disabled = false }: { disabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<PointerState>({
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    down: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frame = 0;
    let lastDraw = 0;
    let inView = true;
    let pageVisible = !document.hidden;
    let cells: FieldCell[] = [];
    const cellWidth = 18;
    const cellHeight = 18;

    const buildField = () => {
      width = Math.max(1, canvas.clientWidth);
      height = Math.max(1, canvas.clientHeight);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const columns = Math.ceil(width / cellWidth) + 1;
      const rows = Math.ceil(height / cellHeight) + 1;
      cells = [];

      for (let row = 0; row < rows; row += 1) {
        const term = fieldTerms[Math.floor(row / 7) % fieldTerms.length];
        const termStart = (row * 13) % Math.max(columns - term.length - 4, 1) + 2;

        for (let column = 0; column < columns; column += 1) {
          const isTerm = row % 7 === 3 && column >= termStart && column < termStart + term.length;
          const index = Math.abs((column * 17 + row * 7) % glyphs.length);
          cells.push({
            x: column * cellWidth + 4,
            y: row * cellHeight + 13,
            dx: 0,
            dy: 0,
            vx: 0,
            vy: 0,
            glyph: isTerm ? term[column - termStart] : glyphs[index],
            phase: (column * 0.67 + row * 0.31) % (Math.PI * 2),
          });
        }
      }
    };

    const draw = (time: number, animate: boolean) => {
      context.clearRect(0, 0, width, height);
      context.font = '500 10px "IBM Plex Mono", monospace';
      context.textBaseline = "alphabetic";

      const pointer = pointerRef.current;
      const radius = Math.min(216, Math.max(148, width * 0.16));

      for (const cell of cells) {
        const flowX = Math.sin(time * 0.00019 + cell.phase) * 0.85;
        const flowY = Math.cos(time * 0.00016 + cell.phase * 1.7) * 0.6;

        if (pointer.down && animate) {
          const deltaX = cell.x - pointer.x;
          const deltaY = cell.y - pointer.y;
          const distance = Math.hypot(deltaX, deltaY) || 1;

          if (distance < radius) {
            const strength = (1 - distance / radius) ** 2;
            cell.vx += (deltaX / distance) * strength * 1.5 + pointer.vx * strength * 0.075;
            cell.vy += (deltaY / distance) * strength * 1.5 + pointer.vy * strength * 0.075;
          }
        }

        if (animate) {
          cell.vx += -cell.dx * 0.048;
          cell.vy += -cell.dy * 0.048;
          cell.vx *= 0.86;
          cell.vy *= 0.86;
          cell.dx += cell.vx;
          cell.dy += cell.vy;
        }

        const energy = Math.min(1, Math.hypot(cell.dx, cell.dy) / 28);
        const termGlyph = /[A-Z∇]/.test(cell.glyph);
        context.fillStyle = termGlyph
          ? `rgba(211, 197, 255, ${0.28 + energy * 0.56})`
          : `rgba(157, 122, 255, ${0.12 + energy * 0.4})`;
        context.fillText(cell.glyph, cell.x + cell.dx + flowX, cell.y + cell.dy + flowY);
      }
    };

    const start = () => {
      if (frame || disabled || !inView || !pageVisible) return;
      frame = window.requestAnimationFrame(tick);
    };

    const tick = (time: number) => {
      frame = 0;
      if (disabled || !inView || !pageVisible) return;

      if (time - lastDraw > 33) {
        draw(time, true);
        lastDraw = time;
      }
      frame = window.requestAnimationFrame(tick);
    };

    const onVisibilityChange = () => {
      pageVisible = !document.hidden;
      if (pageVisible) start();
    };

    buildField();
    draw(0, false);

    const resizeObserver = new ResizeObserver(() => {
      buildField();
      draw(performance.now(), false);
    });
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
      if (inView) start();
    }, { threshold: 0.04 });
    intersectionObserver.observe(canvas);
    document.addEventListener("visibilitychange", onVisibilityChange);
    start();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [disabled]);

  const updatePointer = (event: PointerEvent<HTMLDivElement>, down?: boolean) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const previous = pointerRef.current;
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    pointerRef.current = {
      x,
      y,
      px: previous.x,
      py: previous.y,
      vx: x - previous.x,
      vy: y - previous.y,
      down: down ?? previous.down,
    };
  };

  const releasePointer = () => {
    pointerRef.current.down = false;
    pointerRef.current.vx = 0;
    pointerRef.current.vy = 0;
  };

  return (
    <div
      className={`liquid-ascii${disabled ? " is-static" : ""}`}
      aria-hidden="true"
      onPointerDown={(event) => {
        if (disabled || !event.isPrimary) return;
        updatePointer(event, true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (disabled || !pointerRef.current.down) return;
        updatePointer(event, true);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        releasePointer();
      }}
      onPointerCancel={releasePointer}
    >
      <canvas ref={canvasRef} />
      <div className="liquid-ascii__readout">
        <span>Physical AI / Flow field</span>
        <small>Drag to perturb</small>
      </div>
    </div>
  );
}
