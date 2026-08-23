import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useCompact } from "../../hooks";
import { appleEase, inViewViewport } from "./spring";

interface MotionSectionProps {
  as?: "section" | "div" | "article";
  className?: string;
  id?: string;
  children: ReactNode;
  delay?: number;
}

export function MotionSection({
  as = "div",
  className,
  id,
  children,
  delay = 0,
}: MotionSectionProps) {
  const reduceMotion = useReducedMotion();
  const compact = useCompact();
  const skipReveal = Boolean(reduceMotion || compact);
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      id={id}
      initial={skipReveal ? false : { opacity: 0, y: 28, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={inViewViewport}
      transition={{ duration: 0.9, delay, ease: appleEase }}
    >
      {children}
    </Tag>
  );
}
