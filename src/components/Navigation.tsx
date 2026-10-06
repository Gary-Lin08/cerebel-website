import { useEffect, useState } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/ArrowUpRight";
import { List } from "@phosphor-icons/react/List";
import { X } from "@phosphor-icons/react/X";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { navItems } from "../content";
import { useCompact } from "../hooks";

interface NavigationProps {
  activeSection: string;
}

export function Navigation({ activeSection }: NavigationProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const compact = useCompact();
  const skipReveal = Boolean(reduceMotion || compact);

  useEffect(() => {
    document.body.dataset.menuOpen = menuOpen ? "true" : "false";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    if (menuOpen) window.addEventListener("keydown", onKeyDown);
    return () => {
      delete document.body.dataset.menuOpen;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // The bar takes its tone from whatever chapter is passing underneath it.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = 46;
      let tone = "dark";
      for (const surface of document.querySelectorAll<HTMLElement>("main [data-nav-tone]")) {
        const bounds = surface.getBoundingClientRect();
        if (bounds.top <= line && bounds.bottom > line) tone = surface.dataset.navTone ?? "dark";
      }
      if (document.body.dataset.navTone !== tone) document.body.dataset.navTone = tone;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      delete document.body.dataset.navTone;
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <header className="site-nav" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="Cerebel AI home">
          <img
            src="/assets/cerebel-wordmark.png"
            alt="Cerebel"
            width="595"
            height="194"
          />
        </a>

        <nav className="site-nav__links" aria-label="Main sections">
          {navItems.map((item) => (
            <a
              key={item.href}
              className={
                item.href.startsWith("#") && activeSection === item.href.slice(1)
                  ? "site-nav__link is-active"
                  : "site-nav__link"
              }
              href={item.href}
            >
              {item.label}
              {activeSection === item.href.slice(1) ? (
                // One underline that travels between chapters instead of blinking on and off.
                <motion.span
                  className="site-nav__indicator"
                  layoutId="site-nav-indicator"
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
                  aria-hidden="true"
                />
              ) : null}
            </a>
          ))}
        </nav>

        <a className="nav-cta" href="#demo">
          Request a Demo
          <ArrowUpRight aria-hidden="true" weight="bold" />
        </a>

        <button
          className="menu-button"
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          <span className="sr-only">Open navigation menu</span>
          <List aria-hidden="true" />
        </button>
      </header>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            className="mobile-menu"
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            initial={skipReveal ? false : { clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={reduceMotion ? undefined : { clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.45, ease: [0.65, 0, 0.35, 1] }}
          >
            <div className="mobile-menu__top">
              <span className="wordmark">
                <img
                  src="/assets/cerebel-wordmark.png"
                  alt="Cerebel"
                  width="595"
                  height="194"
                />
              </span>
              <button
                type="button"
                onClick={closeMenu}
                aria-label="Close menu"
                autoFocus
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Mobile sections">
              {navItems.map((item, index) => (
                <a key={item.href} href={item.href} onClick={closeMenu}>
                  <span>0{index + 1}</span>
                  {item.label}
                </a>
              ))}
              <a className="mobile-menu__cta" href="#demo" onClick={closeMenu}>
                Request a Demo
                <ArrowUpRight aria-hidden="true" />
              </a>
            </nav>
            <p>We make human physical intelligence legible to machines.</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
