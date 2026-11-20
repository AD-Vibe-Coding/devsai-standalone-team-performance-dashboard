export type KpiKey =
  | "tickets_resolved"
  | "csat"
  | "sla_met"
  | "aht_seconds"
  | "fcr"
  | "occupancy";

export type KpiDef = {
  key: KpiKey;
  label: string;
  short: string;
  unit: "number" | "percent" | "seconds";
  higherIsBetter: boolean;
  description: string;
  formula: string;
};

export const KPI_DEFS: KpiDef[] = [
  {
    key: "tickets_resolved",
    label: "Tickets resolved",
    short: "Resolved",
    unit: "number",
    higherIsBetter: true,
    description: "Closed tickets credited to the agent in the selected period.",
    formula: "Count of tickets with status Resolved in the import file.",
  },
  {
    key: "csat",
    label: "CSAT",
    short: "CSAT",
    unit: "percent",
    higherIsBetter: true,
    description: "Share of survey responses rated 4 or 5.",
    formula: "Satisfied responses ÷ total survey responses × 100.",
  },
  {
    key: "sla_met",
    label: "SLA met",
    short: "SLA",
    unit: "percent",
    higherIsBetter: true,
    description: "Share of tickets answered inside the published SLA.",
    formula: "Tickets within SLA ÷ tickets with an SLA clock × 100.",
  },
  {
    key: "aht_seconds",
    label: "Average handle time",
    short: "AHT",
    unit: "seconds",
    higherIsBetter: false,
    description: "Mean talk + hold + wrap time per contact.",
    formula: "Sum of handle seconds ÷ contacts handled.",
  },
  {
    key: "fcr",
    label: "First contact resolution",
    short: "FCR",
    unit: "percent",
    higherIsBetter: true,
    description: "Contacts closed without a follow-up in 24 hours.",
    formula: "First-contact closes ÷ eligible contacts × 100.",
  },
  {
    key: "occupancy",
    label: "Occupancy",
    short: "Occupancy",
    unit: "percent",
    higherIsBetter: true,
    description: "Time spent handling work versus staffed time.",
    formula: "Handle time ÷ staffed time × 100.",
  },
];

export const KPI_BY_KEY = Object.fromEntries(KPI_DEFS.map((k) => [k.key, k])) as Record<
  KpiKey,
  KpiDef
>;

export const REQUIRED_IMPORT_COLUMNS = [
  "date",
  "team",
  "agent",
  "metric_key",
  "value",
] as const;

export function formatKpi(value: number, unit: KpiDef["unit"]) {
  if (!Number.isFinite(value)) return "—";
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "seconds") {
    const m = Math.floor(value / 60);
    const s = Math.round(value % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}
