// Content for the scroll experience. Every figure here is taken from data already in the repo
// (benchmark table, golf-1872 swing analysis) or from facts confirmed in AGENTS.md.

export type Chapter = {
  id: string;
  act: number; // which WebGL scene is on stage
  group: string; // menu / side-rail group label
  length: number; // scroll length in viewport heights
};

export const ACTS = ["origin", "swing", "ski", "benchmark", "glasses", "field"] as const;

export const chapters: Chapter[] = [
  { id: "hero", act: 0, group: "Origin", length: 1.1 },
  { id: "legible", act: 0, group: "Origin", length: 2.4 },
  { id: "swing-intro", act: 1, group: "Motion", length: 1.1 },
  { id: "sway", act: 1, group: "Motion", length: 1.3 },
  { id: "trail-knee", act: 1, group: "Motion", length: 1.3 },
  { id: "lead-arm", act: 1, group: "Motion", length: 1.1 },
  { id: "hang-back", act: 1, group: "Motion", length: 1.3 },
  { id: "finish", act: 1, group: "Motion", length: 1.2 },
  { id: "find", act: 1, group: "Motion", length: 1.3 },
  { id: "ski-intro", act: 2, group: "Snow", length: 1.1 },
  { id: "ski-load", act: 2, group: "Snow", length: 1.3 },
  { id: "ski-edge", act: 2, group: "Snow", length: 1.3 },
  { id: "benchmark", act: 3, group: "Benchmark", length: 2.4 },
  { id: "glasses-intro", act: 4, group: "Glasses", length: 1.0 },
  { id: "g-optical", act: 4, group: "Glasses", length: 0.9 },
  { id: "g-clock", act: 4, group: "Glasses", length: 0.9 },
  { id: "g-prep", act: 4, group: "Glasses", length: 0.9 },
  { id: "g-modular", act: 4, group: "Glasses", length: 0.9 },
  { id: "field", act: 5, group: "Field", length: 1.5 },
  { id: "company", act: 5, group: "Field", length: 1.2 },
  { id: "contact", act: 5, group: "Field", length: 1.2 },
];

// [method, MPJPE, PA-MPJPE, GND, T-head] — published AMASS comparison, as in the existing site.
export const benchmark = {
  "32": [
    ["CeRebel", 129.8, 109.8, 0.98, 6.4],
    ["NoShape", 138.1, 118.8, 0.94, 44.7],
    ["EgoEgo", 184.0, 158.6, 0.81, 45.2],
    ["VAE+Opt", 199.5, 191.4, 0.49, 78.0],
  ],
  "128": [
    ["CeRebel", 119.7, 101.1, 1.0, 6.2],
    ["NoShape", 128.1, 110.3, 0.98, 44.6],
    ["EgoEgo", 167.4, 145.8, 0.92, 54.9],
    ["VAE+Opt", 205.3, 192.3, 0.75, 67.8],
  ],
} as const;

export const glassesParts = [
  {
    id: "g-optical",
    n: "01",
    title: "Optical path",
    copy: "A forward camera pair and an in-lens display layer share one optical stack, so what the wearer sees and what the system records start from the same view.",
  },
  {
    id: "g-clock",
    n: "02",
    title: "Shared-clock synchronization",
    copy: "Image and motion signals are stamped against one clock at the source. Alignment is designed in, not repaired afterwards.",
  },
  {
    id: "g-prep",
    n: "03",
    title: "Near-capture data preparation",
    copy: "Signals are organised next to where they are captured, so a session arrives structured for reconstruction rather than as loose footage.",
  },
  {
    id: "g-modular",
    n: "04",
    title: "Modular architecture",
    copy: "Sensing, compute and power sit in separable modules, so the development configuration can change without redrawing the frame.",
  },
] as const;
