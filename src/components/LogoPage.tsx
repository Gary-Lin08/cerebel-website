import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { ArrowUpRight } from "@phosphor-icons/react/ArrowUpRight";
import { useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import ElectricBorder from "./reactbits/ElectricBorder";
import GridMotion from "./reactbits/GridMotion";

const fieldTokens = [
  "C", "01", "·", "M", "∿", "03", "×",
  "BODY", "∇", "04", "C", "→", "∿",
  "02", "MOTION", "·", "05", "C", "↗",
  "FIELD", "×", "06", "∿", "BODY", "·", "C", "07", "M",
];

const fieldItems: ReactNode[] = fieldTokens.map((token, index) => (
  <span className={`logo-page__grid-token logo-page__grid-token--${index % 5}`} key={`${token}-${index}`}>
    {token}
  </span>
));

export function LogoPage() {
  const reduceMotion = useReducedMotion();
  const paused = Boolean(reduceMotion);

  return (
    <div className="logo-page">
      <div className="logo-page__field" aria-hidden="true">
        <GridMotion items={fieldItems} gradientColor="rgba(125, 79, 255, 0.26)" paused={paused} />
      </div>
      <div className="logo-page__grain" aria-hidden="true" />
      <div className="logo-page__vignette" aria-hidden="true" />

      <header className="logo-page__nav">
        <a className="logo-page__back" href="/#top">
          <ArrowLeft aria-hidden="true" weight="bold" />
          <span>Back to site</span>
        </a>
        <span className="logo-page__edition">Identity field / 01</span>
        <a className="logo-page__enter" href="/#top">
          Enter Cerebel
          <ArrowUpRight aria-hidden="true" weight="bold" />
        </a>
      </header>

      <main className="logo-page__main">
        <p className="logo-page__eyebrow">Cerebel AI / Motion intelligence</p>
        <ElectricBorder
          className="logo-page__lockup-frame"
          color="#8D5BFF"
          speed={0.42}
          chaos={0.045}
          borderRadius={38}
          paused={paused}
        >
          <div className="logo-page__lockup">
            <span className="logo-page__scan" aria-hidden="true" />
            <img src="/assets/cerebel-wordmark.png" alt="Cerebel AI" width="595" height="194" />
            <p>We make human physical intelligence legible to machines.</p>
          </div>
        </ElectricBorder>

        <div className="logo-page__signal-rail" aria-label="Cerebel translates movement into machine-readable intelligence">
          <span>Movement</span>
          <i aria-hidden="true" />
          <span>Structure</span>
          <i aria-hidden="true" />
          <span>Intelligence</span>
        </div>
      </main>

      <footer className="logo-page__footer">
        <p>Physical intelligence, made legible.</p>
        <a href="mailto:hello@cerebel.tech">hello@cerebel.tech</a>
      </footer>
    </div>
  );
}
