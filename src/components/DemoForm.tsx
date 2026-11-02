import { useState, type FormEvent } from "react";
import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { WarningCircle } from "@phosphor-icons/react/WarningCircle";
import { interestOptions } from "../content";
import { getAttribution, trackEvent } from "../analytics";

type FormStatus = "idle" | "loading" | "success" | "preview" | "error";

// Where demo requests are sent: a public Supabase function, the same way the presale sheet works, so a
// request does not depend on the Playground server. The key is the publishable one and can only call
// that function; the table itself cannot be read with it. A local dev build sends nothing unless
// configured, and the form says so.
const liveEndpoint = "https://zmwcglopxlsbewvegoyw.supabase.co/rest/v1/rpc/submit_demo_request";
const liveKey = "sb_publishable_S21fJaJ1EVKxDJp6V65oIA_C3zEQFNP";
const endpoint = (import.meta.env.VITE_DEMO_ENDPOINT ?? (import.meta.env.PROD ? liveEndpoint : "")).trim();
const apiKey = (import.meta.env.VITE_BACKER_API_KEY ?? (import.meta.env.PROD ? liveKey : "")).trim();
const contact = "hello@cerebel.tech";

export function DemoForm() {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const nextErrors: Record<string, string> = {};

    for (const field of ["name", "email", "organization", "interest", "message"]) {
      if (!String(data.get(field) ?? "").trim()) {
        nextErrors[field] = "This field is required.";
      }
    }

    const email = String(data.get("email") ?? "");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid work email.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus("error");
      return;
    }

    if (!endpoint) {
      // `vite dev` without VITE_DEMO_ENDPOINT: nothing is sent, and the form says so.
      setStatus("preview");
      return;
    }

    setStatus("loading");
    const request = {
      name: String(data.get("name")),
      email: String(data.get("email")).trim(),
      organization: String(data.get("organization")),
      interest: String(data.get("interest")),
      message: String(data.get("message")),
      ...getAttribution(),
    };
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...(apiKey ? { apikey: apiKey } : {}) },
        body: JSON.stringify(apiKey ? { p: request } : request),
      });
      if (!response.ok) {
        // PostgREST reports a function's own message as `message`; other backends use `error`.
        const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        const reason = response.status === 400 ? payload.error || payload.message : "";
        throw new Error(reason || `We could not send that just now. Try again, or write to ${contact}.`);
      }
      setStatus("success");
      form.reset();
    } catch (error) {
      setStatus("error");
      setErrors({
        form: error instanceof Error && error.message ? error.message : `We could not send that just now. Try again, or write to ${contact}.`,
      });
    }
  };

  return (
    <form
      className="demo-form"
      onSubmit={handleSubmit}
      onFocus={() => void trackEvent("form_start", { target: "demo-form" })}
      noValidate
    >
      <div className="demo-form__row">
        <FormField label="Name" name="name" error={errors.name} />
        <FormField
          label="Work email"
          name="email"
          type="email"
          error={errors.email}
        />
      </div>
      <div className="demo-form__row">
        <FormField
          label="Organization"
          name="organization"
          error={errors.organization}
        />
        <label className="form-field">
          <span>Area of interest</span>
          <select
            name="interest"
            defaultValue=""
            aria-invalid={Boolean(errors.interest)}
            aria-describedby={errors.interest ? "interest-error" : undefined}
          >
            <option value="" disabled>
              Select an area
            </option>
            {interestOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {errors.interest ? (
            <small id="interest-error">{errors.interest}</small>
          ) : null}
        </label>
      </div>
      <label className="form-field form-field--message">
        <span>Message</span>
        <textarea
          name="message"
          rows={4}
          placeholder="Tell us about your system, research, or product challenge."
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "message-error" : undefined}
        />
        {errors.message ? <small id="message-error">{errors.message}</small> : null}
      </label>

      <div className="demo-form__footer">
        <button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Sending…" : "Request a Demo"}
          <ArrowRight aria-hidden="true" />
        </button>
        <div className="form-status" aria-live="polite">
          {status === "success" ? (
            <>
              <CheckCircle weight="fill" aria-hidden="true" />
              Thank you. We have your request and will follow up.
            </>
          ) : null}
          {status === "preview" ? (
            <>
              <WarningCircle weight="fill" aria-hidden="true" />
              Not sent: this development build has no form endpoint. Set VITE_DEMO_ENDPOINT to connect it.
            </>
          ) : null}
          {status === "error" && Object.keys(errors).length > 0 ? (
            <>
              <WarningCircle weight="fill" aria-hidden="true" />
              {errors.form || "Check the highlighted fields and try again."}
            </>
          ) : null}
        </div>
      </div>
    </form>
  );
}

interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  error?: string;
}

function FormField({ label, name, type = "text", error }: FormFieldProps) {
  const errorId = `${name}-error`;
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        type={type}
        name={name}
        autoComplete={
          name === "name"
            ? "name"
            : name === "email"
              ? "email"
              : name === "organization"
                ? "organization"
                : undefined
        }
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? <small id={errorId}>{error}</small> : null}
    </label>
  );
}
