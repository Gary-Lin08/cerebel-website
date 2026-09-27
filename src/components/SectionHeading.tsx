import { motion, useReducedMotion } from "motion/react";
import { Reveal } from "./motion/Reveal";
import { useCompact } from "../hooks";
import { appleEase, inViewViewport } from "./motion/spring";

interface SectionHeadingProps {
  eyebrow: string;
  title: string | readonly string[];
  copy?: string;
  align?: "left" | "right";
  compact?: boolean;
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
  align = "left",
  compact = false,
}: SectionHeadingProps) {
  const reduceMotion = useReducedMotion();
  const isCompact = useCompact();
  const skipReveal = Boolean(reduceMotion || isCompact || compact);

  return (
    <header className={`section-heading section-heading--${align}${compact ? " section-heading--compact" : ""}`}>
      <motion.p
        className="eyebrow"
        initial={skipReveal ? false : { y: 12, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={inViewViewport}
        transition={{ duration: 0.7, ease: appleEase }}
      >
        {eyebrow}
      </motion.p>
      {compact ? <h2>{typeof title === "string" ? title : title.join(" ")}</h2> : <Reveal as="h2" text={title} />}
      {copy ? (
        <motion.p
          className="section-heading__copy"
          initial={skipReveal ? false : { y: 16, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={inViewViewport}
          transition={{ duration: 0.9, delay: 0.18, ease: appleEase }}
        >
          {copy}
        </motion.p>
      ) : null}
    </header>
  );
}
