// A short email to the team for every new sign-up, when RESEND_API_KEY is set. Never required:
// the record is already saved before this runs, and a failure here is logged, not surfaced.
const NOTIFY_TO = process.env.SIGNUP_NOTIFY_TO || "hello@cerebel.tech";
const NOTIFY_FROM = process.env.SIGNUP_NOTIFY_FROM || "Cerebel site <hello@cerebel.tech>";

export async function notify(subject, lines, { fetchImpl = fetch, apiKey = process.env.RESEND_API_KEY } = {}) {
  if (!apiKey) return false;
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: NOTIFY_FROM, to: [NOTIFY_TO], subject, text: lines.join("\n") }),
    });
    if (!response.ok) console.error(`notify: Resend answered ${response.status}`);
    return response.ok;
  } catch (error) {
    console.error("notify:", error);
    return false;
  }
}
