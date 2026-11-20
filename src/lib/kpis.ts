export type KpiKey =
  | "avg_ack_seconds"
  | "ack_under_5_pct"
  | "carrier_open_sla_pct"
  | "refused_calls"
  | "asa_seconds"
  | "mobility_sla_pct";

export type KpiUnit = "number" | "percent" | "seconds";

export type SlaRule =
  | { kind: "under"; value: number; label: string }
  | { kind: "at_least"; value: number; label: string }
  | { kind: "at_most"; value: number; label: string }
  | { kind: "display"; label: string };

export type KpiDef = {
  key: KpiKey;
  label: string;
  short: string;
  unit: KpiUnit;
  higherIsBetter: boolean;
  description: string;
  formula: string;
  memberSla: SlaRule;
  overallSla: SlaRule | null;
  showOnTeam: boolean;
  /** When set, Overview overall card uses this companion metric instead of averaging this key. */
  overallKey?: KpiKey;
};

export const KPI_DEFS: KpiDef[] = [
  {
    key: "avg_ack_seconds",
    overallKey: "ack_under_5_pct",
    label: "Average acknowledgement time",
    short: "Avg ack",
    unit: "seconds",
    higherIsBetter: false,
    description:
      "How long it takes to acknowledge a ticket. Member target is under 3 minutes. The floor-wide SLA is the share of tickets acknowledged under 5 minutes.",
    formula: "Member: mean ack seconds. Overall: tickets acked in under 5 minutes ÷ tickets × 100.",
    memberSla: { kind: "under", value: 180, label: "under 3 minutes" },
    overallSla: { kind: "display", label: "% of tickets acked under 5 minutes" },
    showOnTeam: true,
  },
  {
    key: "carrier_open_sla_pct",
    label: "Time to open ticket with the carrier",
    short: "Carrier open",
    unit: "percent",
    higherIsBetter: true,
    description: "Share of carrier tickets opened inside the published window.",
    formula: "On-time carrier opens ÷ carrier tickets × 100. Member and team SLA: more than 90%.",
    memberSla: { kind: "at_least", value: 90, label: "more than 90%" },
    overallSla: { kind: "at_least", value: 90, label: "more than 90%" },
    showOnTeam: true,
  },
  {
    key: "refused_calls",
    label: "Refused calls",
    short: "Refused",
    unit: "number",
    higherIsBetter: false,
    description: "Calls refused by the agent. Tracked per person only — not rolled up as a team KPI.",
    formula: "Count of refused calls in the period. Member SLA: count ≤ 1.",
    memberSla: { kind: "at_most", value: 1, label: "≤ 1" },
    overallSla: null,
    showOnTeam: false,
  },
  {
    key: "asa_seconds",
    label: "Average speed of answer",
    short: "ASA",
    unit: "seconds",
    higherIsBetter: false,
    description: "Mean time for a call to be answered.",
    formula: "Sum of answer seconds ÷ calls answered. Member and team SLA: under 8 seconds.",
    memberSla: { kind: "under", value: 8, label: "under 8 seconds" },
    overallSla: { kind: "under", value: 8, label: "under 8 seconds" },
    showOnTeam: true,
  },
  {
    key: "mobility_sla_pct",
    label: "Mobility tasks SLA",
    short: "Mobility",
    unit: "percent",
    higherIsBetter: true,
    description: "Share of mobility tasks finished inside 60 minutes.",
    formula: "Tasks completed in under 60 minutes ÷ mobility tasks × 100. Member and team SLA: over 90%.",
    memberSla: { kind: "at_least", value: 90, label: "over 90% under 60 minutes" },
    overallSla: { kind: "at_least", value: 90, label: "over 90% under 60 minutes" },
    showOnTeam: true,
  },
];

/** Import-only companion used for overall Avg Ack. Hidden from member tables as a primary KPI. */
export const ACK_UNDER_5: KpiDef = {
  key: "ack_under_5_pct",
  label: "Acked under 5 minutes",
  short: "Ack <5m",
  unit: "percent",
  higherIsBetter: true,
  description: "Share of tickets acknowledged in under 5 minutes (overall Avg Ack SLA).",
  formula: "Tickets acked in under 5 minutes ÷ tickets × 100.",
  memberSla: { kind: "display", label: "feeds overall Avg Ack" },
  overallSla: { kind: "display", label: "% of tickets acked under 5 minutes" },
  showOnTeam: true,
};

export const KPI_BY_KEY = Object.fromEntries([...KPI_DEFS, ACK_UNDER_5].map((k) => [k.key, k])) as Record<
  KpiKey,
  KpiDef
>;

export const TEAM_KPI_DEFS = KPI_DEFS.filter((k) => k.showOnTeam);

export function formatKpi(value: number, unit: KpiUnit) {
  if (!Number.isFinite(value)) return "—";
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "seconds") {
    if (value < 60) return `${value.toFixed(value % 1 === 0 ? 0 : 1)}s`;
    const m = Math.floor(value / 60);
    const s = Math.round(value % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

export function slaMet(rule: SlaRule | null, value: number): boolean | null {
  if (!rule || !Number.isFinite(value)) return null;
  if (rule.kind === "under") return value < rule.value;
  if (rule.kind === "at_least") return value >= rule.value;
  if (rule.kind === "at_most") return value <= rule.value;
  return null;
}

export function slaLabel(rule: SlaRule | null) {
  return rule?.label ?? "not scored at team level";
}
