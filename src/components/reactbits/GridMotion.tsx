import { useEffect, useRef, type FC, type ReactNode } from "react";
import { gsap } from "gsap";
import "./grid-motion.css";

interface GridMotionProps {
  items?: (string | ReactNode)[];
  gradientColor?: string;
  className?: string;
  paused?: boolean;
}

// React Bits — Grid Motion (TS/CSS variant), scoped and pausable for use as a
// decorative identity field rather than a full-page layout primitive.
const GridMotion: FC<GridMotionProps> = ({
  items = [],
  gradientColor = "black",
  className,
  paused = false,
}) => {
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mouseXRef = useRef(0);
  const totalItems = 28;
  const defaultItems = Array.from({ length: totalItems }, (_, index) => `Item ${index + 1}`);
  const combinedItems = items.length > 0 ? items.slice(0, totalItems) : defaultItems;

  useEffect(() => {
    if (paused) return;

    mouseXRef.current = window.innerWidth / 2;
    gsap.ticker.lagSmoothing(0);

    const handleMouseMove = (event: MouseEvent) => {
      mouseXRef.current = event.clientX;
    };
    const updateMotion = () => {
      const maxMoveAmount = 300;
      const inertiaFactors = [0.6, 0.4, 0.3, 0.2];

      rowRefs.current.forEach((row, index) => {
        if (!row) return;
        const direction = index % 2 === 0 ? 1 : -1;
        const moveAmount = ((mouseXRef.current / window.innerWidth) * maxMoveAmount - maxMoveAmount / 2) * direction;
        gsap.to(row, {
          x: moveAmount,
          duration: 0.8 + inertiaFactors[index % inertiaFactors.length],
          ease: "power3.out",
          overwrite: "auto",
        });
      });
    };

    const removeAnimationLoop = gsap.ticker.add(updateMotion);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      removeAnimationLoop();
    };
  }, [paused]);

  return (
    <div className={`rb-grid-motion ${paused ? "is-paused" : ""} ${className ?? ""}`}>
      <section className="rb-grid-motion__stage" style={{ background: `radial-gradient(circle, ${gradientColor} 0%, transparent 68%)` }}>
        <div className="rb-grid-motion__field" aria-hidden="true">
          {Array.from({ length: 4 }, (_, rowIndex) => (
            <div
              key={rowIndex}
              className="rb-grid-motion__row"
              ref={(element) => {
                rowRefs.current[rowIndex] = element;
              }}
            >
              {Array.from({ length: 7 }, (_, itemIndex) => {
                const content = combinedItems[rowIndex * 7 + itemIndex];
                return (
                  <div key={itemIndex} className="rb-grid-motion__cell">
                    <div className="rb-grid-motion__cell-inner">
                      {typeof content === "string" && content.startsWith("http") ? (
                        <div className="rb-grid-motion__image" style={{ backgroundImage: `url(${content})` }} />
                      ) : (
                        <div className="rb-grid-motion__content">{content}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default GridMotion;
