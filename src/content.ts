export const navItems = [
  { label: "Glasses", href: "#wearable" },
  { label: "Motion", href: "#technology" },
  { label: "Evidence", href: "#evidence" },
  { label: "Benchmark", href: "#benchmark" },
  { label: "Field", href: "#field" },
  { label: "Company", href: "#company" },
] as const;

export const technologyLayers = [
  ["01", "Wearable hardware", "Lightweight, task-ready capture"],
  ["02", "Egocentric vision", "Wide-FOV and fisheye imaging"],
  ["03", "Multimodal sensing", "Optional synchronized signals"],
  ["04", "Body + hand reconstruction", "From movement signals to physical intelligence"],
  ["05", "Interaction understanding", "Hands, objects, and contact"],
  ["06", "Temporal synchronization", "Aligned visual and sensor streams"],
  ["07", "Structured data pipeline", "AI-ready spatial representations"],
] as const;

export const applications = [
  {
    id: "robotics",
    index: "01",
    name: "Robotics",
    title: "Human demonstration, captured in context.",
    copy: "Collect natural manipulation and task demonstrations from the operator’s point of view, then structure the body, hand, object, and temporal signals needed for downstream research.",
    outputs: ["Hand trajectories", "Object state", "Action sequences"],
  },
  {
    id: "industrial",
    index: "02",
    name: "Industrial Operations",
    title: "Understand work where it actually happens.",
    copy: "Capture tool use, maintenance steps, and operational workflows in real environments without surrounding the operator with a studio setup.",
    outputs: ["Tool interaction", "Workflow context", "Temporal steps"],
  },
  {
    id: "sports",
    index: "03",
    name: "Sports Intelligence",
    title: "Keep movement natural.",
    copy: "Explore athletic motion, body state, and task context with a wearable capture system designed not to turn the athlete into a sensor rig.",
    outputs: ["Body motion", "Contact events", "Action trajectories"],
  },
  {
    id: "research",
    index: "04",
    name: "Research + Digital Humans",
    title: "Study behavior as a time-based system.",
    copy: "Support egocentric behavior research, human reconstruction, animation, and digital representations with synchronized spatial context.",
    outputs: ["Body + hands", "Interaction graph", "Spatial sequences"],
  },
] as const;

export const interestOptions = [
  "Sports and Coaching",
  "Robotics and Embodied AI",
  "Research Collaboration",
  "Industrial Application",
  "Wearable Product Partnership",
  "Investment and Strategic Partnership",
] as const;

export const teamAffiliations = [
  {
    id: "founder",
    role: "Founder, CEO",
    caption: "Babson / Olin",
    marks: [
      {
        name: "Babson College",
        src: "/assets/affiliations/babson.svg",
        href: "https://www.babson.edu/",
        width: 1600,
        height: 304,
      },
    ],
  },
  {
    id: "cto",
    role: "Cofounder, CTO",
    caption: "Duke",
    marks: [
      {
        name: "Duke University",
        src: "/assets/affiliations/duke.svg",
        href: "https://www.duke.edu/",
        width: 201,
        height: 88,
      },
    ],
  },
  {
    id: "usc",
    role: "Cofounder, CFO",
    caption: "USC Marshall · USC Viterbi",
    marks: [
      {
        name: "USC Marshall School of Business",
        src: "/assets/affiliations/usc-marshall.png",
        href: "https://www.marshall.usc.edu/",
        width: 1288,
        height: 305,
      },
      {
        name: "USC Viterbi School of Engineering",
        src: "/assets/affiliations/usc-viterbi.svg",
        href: "https://viterbischool.usc.edu/",
        width: 334,
        height: 92,
      },
    ],
  },
  {
    id: "adviser",
    role: "Adviser",
    caption: "The Wharton School",
    marks: [
      {
        name: "The Wharton School, University of Pennsylvania",
        src: "/assets/affiliations/upenn-wharton.png",
        href: "https://www.wharton.upenn.edu/",
        width: 864,
        height: 218,
      },
    ],
  },
] as const;
