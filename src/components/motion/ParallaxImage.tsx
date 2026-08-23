import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef, type ReactNode } from "react";
import { scrollSpring } from "./spring";

interface ParallaxImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  caption?: string;
  speed?: number;
  sizes?: string;
  srcSet?: string;
  children?: ReactNode;
}

export function ParallaxImage({
  src,
  alt,
  width,
  height,
  className,
  caption,
  speed = 14,
  sizes,
  srcSet,
  children,
}: ParallaxImageProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const yRaw = useTransform(scrollYProgress, [0, 1], [speed, -speed]);
  const y = useSpring(yRaw, scrollSpring);

  return (
    <figure ref={ref} className={`parallax-image ${className ?? ""}`.trim()}>
      <div className="parallax-image__frame">
        <motion.img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          style={reduceMotion ? undefined : { y }}
        />
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
      {children}
    </figure>
  );
}
