import { useEffect, useState, type RefObject } from "react";

/** True once the element comes within `margin` of the viewport; it never turns false again. */
export function useNearViewport(ref: RefObject<Element | null>, margin = "1200px 0px") {
  // Browsers without IntersectionObserver just mount the content straight away.
  const [near, setNear] = useState(() => !("IntersectionObserver" in window));

  useEffect(() => {
    const element = ref.current;
    if (near || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: margin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, margin, near]);

  return near;
}

export function useCompact(query = "(max-width: 900px)") {
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [query]);

  return compact;
}

export function useActiveSection(ids: string[]) {
  const [activeSection, setActiveSection] = useState(ids[0] ?? "");

  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    let animationFrame = 0;

    const updateActiveSection = () => {
      animationFrame = 0;
      const readingLine = Math.min(window.innerHeight * 0.3, 240);
      let nextSection = sections[0]?.id ?? "";

      for (const section of sections) {
        if (section.getBoundingClientRect().top <= readingLine) {
          nextSection = section.id;
          continue;
        }
        break;
      }

      setActiveSection(nextSection);
    };

    const scheduleUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [ids]);

  return activeSection;
}

/**
 * Keeps in-page anchor scrolls honest. The Motion workspace mounts as the page scrolls past it and
 * grows its chapter by about a screen, so a smooth scroll that started above it would stop short of
 * the chapter the visitor asked for. For a few seconds after a hash link is followed (or the page
 * opens on a hash), any change in the page's height re-aims the scroll at that target.
 */
export function useAnchorCorrection(windowMs = 3000) {
  useEffect(() => {
    let target = window.location.hash.slice(1);
    let until = target ? performance.now() + windowMs : 0;
    const main = document.querySelector("main");
    if (!main || !("ResizeObserver" in window)) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;
      target = link.getAttribute("href")!.slice(1);
      until = performance.now() + windowMs;
    };
    const onHashChange = () => {
      target = window.location.hash.slice(1);
      until = performance.now() + windowMs;
    };
    const observer = new ResizeObserver(() => {
      if (!target || performance.now() > until) return;
      const element = document.getElementById(target);
      if (!element) return;
      const top = element.getBoundingClientRect().top + window.scrollY;
      if (Math.abs(window.scrollY - top) < 2) return;
      window.scrollTo({ top, behavior: "smooth" });
    });
    observer.observe(main);
    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [windowMs]);
}
