import { ArrowDown } from "@phosphor-icons/react/ArrowDown";
import { ArrowUpRight } from "@phosphor-icons/react/ArrowUpRight";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useRef, type MouseEvent, type ReactNode } from "react";

interface MagneticButtonProps {
  href: string;
  variant?: "primary" | "secondary";
  icon?: "up-right" | "down";
  children: ReactNode;
}

export function MagneticButton({
  href,
  variant = "primary",
  icon = "up-right",
  children,
}: MagneticButtonProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 260, damping: 26, mass: 0.35 });
  const springY = useSpring(y, { stiffness: 260, damping: 26, mass: 0.35 });

  const onMove = (event: MouseEvent<HTMLAnchorElement>) => {
    if (reduceMotion || !ref.current || !window.matchMedia("(pointer: fine)").matches) return;
    const bounds = ref.current.getBoundingClientRect();
    x.set(Math.max(-3, Math.min(3, (event.clientX - bounds.left - bounds.width / 2) * 0.08)));
    y.set(Math.max(-3, Math.min(3, (event.clientY - bounds.top - bounds.height / 2) * 0.08)));
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  const Icon = icon === "down" ? ArrowDown : ArrowUpRight;

  return (
    <motion.a
      ref={ref}
      className={`button button--${variant} button--magnetic`}
      href={href}
      style={reduceMotion ? undefined : { x: springX, y: springY }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
      <Icon aria-hidden="true" weight="bold" />
    </motion.a>
  );
}
