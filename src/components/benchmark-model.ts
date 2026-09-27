export type BenchmarkAtlasRow = readonly [string, string, string, string, string];
export interface BenchmarkAtlasReference {
  readonly "32": readonly BenchmarkAtlasRow[];
  readonly "128": readonly BenchmarkAtlasRow[];
}
export const benchmarkMetrics = [
  { label: "T-head", index: 4, title: "Head-trajectory error", unit: "mm", direction: "lower", decimals: 1 },
  { label: "MPJPE", index: 1, title: "Joint-position error", unit: "mm", direction: "lower", decimals: 1 },
  { label: "PA-MPJPE", index: 2, title: "Aligned joint-position error", unit: "mm", direction: "lower", decimals: 1 },
  { label: "GND", index: 3, title: "Ground-contact score", unit: "score", direction: "higher", decimals: 2 },
] as const;
export type BenchmarkMetric = typeof benchmarkMetrics[number];

export function buildComparison(rows: readonly BenchmarkAtlasRow[], metric: BenchmarkMetric) {
  const ranked = rows.map(row => ({
    method: row[0], value: Number.parseFloat(row[metric.index]),
    display: row[metric.index].split("±")[0], exact: row[metric.index],
  })).sort((a, b) => metric.direction === "lower" ? a.value - b.value : b.value - a.value);
  const leader = ranked[0];
  const next = ranked[1];
  const scale = metric.direction === "higher" ? Math.max(1, ...ranked.map(row => row.value)) : Math.ceil(Math.max(...ranked.map(row => row.value)) / 10) * 10;
  return { ranked, leader, next, scale, gap: Math.abs(next.value - leader.value) };
}
