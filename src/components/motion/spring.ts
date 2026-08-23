export const appleEase = [0.16, 1, 0.3, 1] as const;

export const revealTransition = {
  duration: 0.95,
  ease: appleEase,
};

export const spatialSpring = {
  type: "spring" as const,
  stiffness: 170,
  damping: 26,
  mass: 0.85,
};

export const scrollSpring = {
  stiffness: 92,
  damping: 26,
  mass: 0.72,
};

export const inViewViewport = {
  once: true,
  amount: 0.08,
  margin: "64px 0px -6% 0px",
} as const;

export function spatialEnter(
  reduceMotion: boolean | null,
  index = 0,
  compact = false,
) {
  return {
    initial:
      reduceMotion || compact ? false : { opacity: 0, y: 22, scale: 0.975 },
    whileInView: { opacity: 1, y: 0, scale: 1 },
    viewport: inViewViewport,
    transition: {
      duration: 0.82,
      delay: index * 0.06,
      ease: appleEase,
    },
  };
}
