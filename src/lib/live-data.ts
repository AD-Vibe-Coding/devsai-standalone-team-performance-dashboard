import { MONTH_LABELS, QUARTER_LABELS, type PeriodGrain } from "./seed-snapshot";
import { monthKeyFromLabel, quarterKeyFromLabel, type MonthSlice, type UploadResult } from "./parse-excel";
import type { KpiKey } from "./kpis";
import type { VolumeKey } from "./volumes";

export type LiveKpi = { value: number; n: number };
export type LiveOverview = {
  volumes: Record<VolumeKey, number>;
  kpis: Record<string, LiveKpi>;
};

const VOLUME_KEYS: VolumeKey[] = [
  "tickets_received",
  "inbound_calls",
  "outbound_calls",
  "mobility_tasks",
];

export function emptyVolumes(): Record<VolumeKey, number> {
  return {
    tickets_received: 0,
    inbound_calls: 0,
    outbound_calls: 0,
    mobility_tasks: 0,
  };
}

export function periodLabelsLive(grain: PeriodGrain) {
  return grain === "quarter" ? QUARTER_LABELS : MONTH_LABELS;
}

function keysForLabel(grain: PeriodGrain, label: string): string[] {
  return grain === "month"
    ? [monthKeyFromLabel(label)].filter((k): k is string => Boolean(k))
    : quarterKeyFromLabel(label);
}

function slicesFor(uploads: UploadResult[], keys: string[]): MonthSlice[] {
  const set = new Set(keys);
  return uploads.flatMap((u) => u.months.filter((m) => set.has(m.monthKey)));
}

function mergeSlices(slices: MonthSlice[]): LiveOverview {
  const volumes = emptyVolumes();
  const kpiSum: Record<string, number> = {};
  const kpiN: Record<string, number> = {};
  for (const s of slices) {
    for (const k of VOLUME_KEYS) {
      volumes[k] += s.volumes[k] ?? 0;
    }
    for (const [k, v] of Object.entries(s.kpis)) {
      const w = k === "avg_ack_seconds" ? Math.max(1, s.used) : s.used || 1;
      kpiSum[k] = (kpiSum[k] ?? 0) + (v as number) * w;
      kpiN[k] = (kpiN[k] ?? 0) + w;
    }
  }
  const kpis: Record<string, LiveKpi> = {};
  for (const [k, v] of Object.entries(kpiSum)) {
    kpis[k] = { value: v / (kpiN[k] || 1), n: kpiN[k] || 1 };
  }
  return { volumes, kpis };
}

export function liveAt(uploads: UploadResult[], grain: PeriodGrain, index: number) {
  const labels = periodLabelsLive(grain);
  const i = Math.max(0, Math.min(index, labels.length - 1));
  const label = labels[i];
  const overview = mergeSlices(slicesFor(uploads, keysForLabel(grain, label)));
  let previous: LiveOverview | null = null;
  let previousLabel: string | null = null;
  if (i > 0) {
    previousLabel = labels[i - 1];
    previous = mergeSlices(slicesFor(uploads, keysForLabel(grain, previousLabel)));
  }
  return { overview, label, previous, previousLabel, labels };
}

export function liveTrends(uploads: UploadResult[], grain: PeriodGrain) {
  const labels = periodLabelsLive(grain);
  return labels.map((label) => {
    const { volumes, kpis } = mergeSlices(slicesFor(uploads, keysForLabel(grain, label)));
    const flat: Record<string, number> = {};
    for (const [k, cell] of Object.entries(kpis)) flat[k] = cell.value;
    return { label, volumes, kpis: flat };
  });
}

export function liveCarriers(uploads: UploadResult[], grain: PeriodGrain, limit = 5) {
  const labels = periodLabelsLive(grain);
  const keys = labels.flatMap((l) => keysForLabel(grain, l));
  const map = new Map<string, number>();
  for (const s of slicesFor(uploads, keys)) {
    for (const c of s.carriers) map.set(c.name, (map.get(c.name) ?? 0) + c.tickets);
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
  return [...map.entries()]
    .map(([name, tickets]) => ({ name, tickets, share: tickets / total }))
    .sort((a, b) => b.tickets - a.tickets)
    .slice(0, limit);
}

export function hasLiveData(uploads: UploadResult[]) {
  return uploads.some((u) => u.used > 0);
}

export type { KpiKey };
