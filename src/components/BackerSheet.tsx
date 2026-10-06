import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { X } from "@phosphor-icons/react/X";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { getAttribution } from "../analytics";

// Where sign-ups are sent. Until this is configured, nothing is stored on a server, and the
// sheet says so instead of claiming a place on a list that does not exist yet.
const endpoint = (import.meta.env.VITE_BACKER_ENDPOINT ?? "").trim();
const previewStoreKey = "cerebel.backers.preview";
const contact = "hello@cerebel.tech";

const uses = ["Sports and coaching", "Robotics and embodied AI", "Research", "Just curious"] as const;

type Outcome =
  | { kind: "idle" | "sending" }
  | { kind: "listed"; email: string } // stored by the configured endpoint
  | { kind: "preview"; email: string } // local preview only: saved in this browser
  | { kind: "mail"; email: string } // no endpoint in production: handed to the visitor's mail app
  | { kind: "failed"; message: string };

const sheetSpring = { type: "spring", stiffness: 300, damping: 32, mass: 0.9 } as const;

/** The presale call to action in the glasses chapter, and the sheet it grows into. */
export function BackerButton() {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [emailError, setEmailError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const fieldId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const page = document.getElementById("root");
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    // The sheet is portalled beside the page, so the page itself can go inert behind it.
    page?.setAttribute("inert", "");
    emailRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      page?.removeAttribute("inert");
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const name = String(data.get("name") ?? "").trim();
    const use = String(data.get("use") ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address.");
      emailRef.current?.focus();
      return;
    }
    setEmailError("");

    if (endpoint) {
      setOutcome({ kind: "sending" });
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, name, use, list: "glasses-presale", ...getAttribution() }),
        });
        if (!response.ok) throw new Error(`Sign-up failed with ${response.status}.`);
        setOutcome({ kind: "listed", email });
      } catch {
        setOutcome({ kind: "failed", message: `We could not save that just now. Try again, or write to ${contact}.` });
      }
      return;
    }

    if (import.meta.env.DEV) {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(previewStoreKey) ?? "[]");
        const list = Array.isArray(saved) ? saved : [];
        localStorage.setItem(previewStoreKey, JSON.stringify([...list, { email, name, use, at: new Date().toISOString() }]));
      } catch {
        // Storage can be unavailable; the preview state below is still accurate.
      }
      setOutcome({ kind: "preview", email });
      return;
    }

    // No endpoint on a live build: the visitor's own mail app carries the request, so nothing is lost.
    const body = [
      "Please add me to the Cerebel glasses presale list.",
      "",
      `Email: ${email}`,
      name ? `Name: ${name}` : "",
      use ? `I would use them for: ${use}` : "",
    ].filter((line, index) => line || index === 1).join("\n");
    window.location.href = `mailto:${contact}?subject=${encodeURIComponent("Cerebel glasses presale list")}&body=${encodeURIComponent(body)}`;
    setOutcome({ kind: "mail", email });
  };

  const done = outcome.kind === "listed" || outcome.kind === "preview" || outcome.kind === "mail";

  return (
    <>
      <motion.button
        ref={triggerRef}
        type="button"
        layoutId="backer-sheet"
        transition={reduceMotion ? { duration: 0 } : sheetSpring}
        className="backer-button"
        aria-haspopup="dialog"
        data-analytics-target="backer-open"
        onClick={() => {
          setOutcome((current) => (current.kind === "failed" ? { kind: "idle" } : current));
          setOpen(true);
        }}
      >
        <span>Become a backer</span>
        <i aria-hidden="true">Presale opening soon</i>
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              key="backer-layer"
              className="world-sheet-layer world-sheet-layer--backer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.28 }}
              onClick={() => setOpen(false)}
            >
              <i className="world-sheet-layer__glow" aria-hidden="true" />
              <motion.div
                layoutId="backer-sheet"
                transition={reduceMotion ? { duration: 0 } : sheetSpring}
                className="world-sheet world-sheet--backer"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(event) => event.stopPropagation()}
              >
                <motion.div
                  className="world-sheet__content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: reduceMotion ? 0 : 0.14, duration: 0.3 } }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                >
                  <div className="world-sheet__media world-sheet__media--backer">
                    <img src="/media/cerebel-scroll/desktop/frame_0060.webp" alt="Cerebel glasses, development concept." />
                    <p>Concept · In development</p>
                  </div>

                  <div className="world-sheet__body">
                    <p className="world-sheet__eyebrow">Cerebel glasses · Presale</p>
                    {done ? (
                      <div className="backer-done" role="status">
                        <motion.span
                          className="backer-done__mark"
                          initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 22 }}
                        >
                          <CheckCircle weight="fill" aria-hidden="true" />
                        </motion.span>
                        {outcome.kind === "listed" ? (
                          <>
                            <h3 id={titleId}>You're on the list.</h3>
                            <p className="world-sheet__lede">We'll write to {outcome.email} when presale opens, with the price and the timing.</p>
                          </>
                        ) : null}
                        {outcome.kind === "mail" ? (
                          <>
                            <h3 id={titleId}>One step left.</h3>
                            <p className="world-sheet__lede">
                              Your mail app should have opened with a message to {contact}. Send it and you're on the list.
                              If nothing opened, write to us at that address.
                            </p>
                          </>
                        ) : null}
                        {outcome.kind === "preview" ? (
                          <>
                            <h3 id={titleId}>Saved in this preview.</h3>
                            <p className="world-sheet__lede">
                              {outcome.email} was stored in this browser only. Sign-ups are not being sent to Cerebel yet:
                              set VITE_BACKER_ENDPOINT to connect the list.
                            </p>
                          </>
                        ) : null}
                        <button type="button" className="world-sheet__link" onClick={() => setOpen(false)}>
                          Back to the glasses
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3 id={titleId}>Become an early backer.</h3>
                        <p className="world-sheet__lede">
                          Presale has not opened yet. Leave your email and we'll write when it does, with the price and the timing.
                        </p>
                        <form className="backer-form" onSubmit={submit} noValidate>
                          <label htmlFor={`${fieldId}-email`}>Email</label>
                          <input
                            ref={emailRef}
                            id={`${fieldId}-email`}
                            name="email"
                            type="email"
                            autoComplete="email"
                            inputMode="email"
                            placeholder="you@example.com"
                            required
                            aria-invalid={emailError ? true : undefined}
                            aria-describedby={emailError ? `${fieldId}-error` : undefined}
                          />
                          {emailError ? <p className="backer-form__error" id={`${fieldId}-error`}>{emailError}</p> : null}

                          <div className="backer-form__row">
                            <div>
                              <label htmlFor={`${fieldId}-name`}>Name <span>optional</span></label>
                              <input id={`${fieldId}-name`} name="name" type="text" autoComplete="name" />
                            </div>
                            <div>
                              <label htmlFor={`${fieldId}-use`}>I'd use them for <span>optional</span></label>
                              <select id={`${fieldId}-use`} name="use" defaultValue="">
                                <option value="">Choose one</option>
                                {uses.map((use) => <option key={use} value={use}>{use}</option>)}
                              </select>
                            </div>
                          </div>

                          {outcome.kind === "failed" ? <p className="backer-form__error" role="alert">{outcome.message}</p> : null}

                          <button type="submit" className="world-sheet__link" disabled={outcome.kind === "sending"}>
                            {outcome.kind === "sending" ? "Joining" : "Join the list"}
                            <ArrowRight aria-hidden="true" />
                          </button>
                        </form>
                        <p className="backer-note">
                          Joining is free and does not commit you to buy; no payment is taken. We use your email only for presale news.
                          The glasses shown are a development concept, not a finished product, and features and timing can change.
                        </p>
                      </>
                    )}
                  </div>
                </motion.div>

                <button type="button" className="world-sheet__close" onClick={() => setOpen(false)} aria-label="Close">
                  <X aria-hidden="true" />
                </button>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
