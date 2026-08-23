import { motion, useReducedMotion } from "motion/react";
import type { ElementType } from "react";
import { useCompact } from "../../hooks";
import { appleEase, inViewViewport } from "./spring";

type RevealMode = "words" | "lines";

interface RevealProps {
  as?: ElementType;
  text: string | readonly string[];
  mode?: RevealMode;
  delay?: number;
  className?: string;
}

function toLines(text: string | readonly string[]) {
  return typeof text === "string" ? text.split("\n") : [...text];
}

export function Reveal({
  as: Tag = "h2",
  text,
  mode = "words",
  delay = 0,
  className,
}: RevealProps) {
  const reduceMotion = useReducedMotion();
  const compact = useCompact();
  const skipReveal = Boolean(reduceMotion || compact);
  const lines = toLines(text);

  return (
    <Tag className={className}>
      {lines.map((line, lineIndex) => {
        const pieces =
          mode === "lines" ? [line] : line.split(" ").filter(Boolean);

        return (
          <span className="reveal-line" key={`${line}-${lineIndex}`}>
            {pieces.map((piece, pieceIndex) => (
                <span key={`${piece}-${pieceIndex}`}>
                  <span className="reveal-word">
                    <motion.span
                      initial={
                        skipReveal ? false : { y: 20, opacity: 0 }
                      }
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={inViewViewport}
                      transition={{
                        duration: mode === "lines" ? 1.05 : 0.88,
                        delay: delay + lineIndex * 0.12 + pieceIndex * 0.055,
                        ease: appleEase,
                      }}
                    >
                      {piece}
                    </motion.span>
                  </span>
                  {pieceIndex < pieces.length - 1 ? " " : null}
                </span>
              ))}
          </span>
        );
      })}
    </Tag>
  );
}
