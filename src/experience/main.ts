import { mountExperience } from "./index";

history.scrollRestoration = "manual";
window.scrollTo({ top: 0, left: 0, behavior: "instant" });
window.addEventListener("pageshow", event => {
  if (!event.persisted) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
});

mountExperience(document.getElementById("root")!);
