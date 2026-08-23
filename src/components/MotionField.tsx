import { useReducedMotion } from "motion/react";

export function MotionField() {
  const reduceMotion = useReducedMotion();

  return (
    <svg
      className="motion-field"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="motion-field-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9b6cff" stopOpacity="0" />
          <stop offset="45%" stopColor="#9b6cff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#6d5dfc" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="motion-field-b" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d5dfc" stopOpacity="0" />
          <stop offset="50%" stopColor="#c4a6ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#9b6cff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        className={
          reduceMotion ? "motion-field__path" : "motion-field__path is-live"
        }
        d="M90 640 C 220 610, 280 430, 410 390 S 620 470, 740 320 S 980 140, 1180 210 S 1360 390, 1420 280"
        stroke="url(#motion-field-a)"
      />
      <path
        className={
          reduceMotion
            ? "motion-field__path motion-field__path--slow"
            : "motion-field__path motion-field__path--slow is-live"
        }
        d="M40 250 C 210 180, 360 360, 520 300 S 780 120, 940 240 S 1160 520, 1380 470"
        stroke="url(#motion-field-b)"
      />
      <path
        className={
          reduceMotion
            ? "motion-field__path motion-field__path--hand"
            : "motion-field__path motion-field__path--hand is-live"
        }
        d="M260 780 C 340 700, 390 620, 470 590 S 610 610, 690 540 S 820 390, 910 430"
        stroke="#9b6cff"
      />
    </svg>
  );
}
