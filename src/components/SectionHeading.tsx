import { motion, useReducedMotion } from "motion/react";
import { Reveal } from "./motion/Reveal";
import { useCompact } from "../hooks";
import { appleEase, inViewViewport } from "./motion/spring";

interface SectionHeadingProps {
  eyebrow: string;
  title: string | readonly string[];
  copy?: string;
  align?: "left" | "right";
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
  align = "left",
}: SectionHeadingProps) {
  const reduceMotion = useReducedMotion();
  const compact = useCompact();
  const skipReveal = Boolean(reduceMotion || compact);

  return (
    <header className={`section-heading section-heading--${align}`}>
      <motion.p
        className="eyebrow"
        initial={skipReveal ? false : { y: 12, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={inViewViewport}
        transition={{ duration: 0.7, ease: appleEase }}
      >
        {eyebrow}
      </motion.p>
      <Reveal as="h2" text={title} />
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