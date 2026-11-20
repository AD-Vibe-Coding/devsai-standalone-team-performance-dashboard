import { REQUIRED_IMPORT_COLUMNS, type KpiKey, KPI_BY_KEY, IMPORT_KPI_DEFS } from "./kpis";

export type ParsedRow = {
  date: string;
  team: string;
  agent: string;
  metric_key: KpiKey;
  value: number;
};

export type ParseResult = {
  rows: ParsedRow[];
  errors: string[];
};

function splitCsv(text: string): string[][] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length);
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = !q;
      } else if (ch === "," && !q) {
        cells.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
}

export function parseImportText(text: string): ParseResult {
  const table = splitCsv(text);
  if (!table.length) return { rows: [], errors: ["File is empty"] };
  const header = table[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const missing = REQUIRED_IMPORT_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    return {
      rows: [],
      errors: [`Missing columns: ${missing.join(", ")}. Need ${REQUIRED_IMPORT_COLUMNS.join(", ")}.`],
    };
  }
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    const date = (cells[idx.date] || "").slice(0, 10);
    const team = (cells[idx.team] || "").toLowerCase();
    const agent = cells[idx.agent] || "";
    const metric_key = cells[idx.metric_key] as KpiKey;
    const value = Number(cells[idx.value]);
    if (!KPI_BY_KEY[metric_key]) {
      errors.push(`Line ${i + 1}: unknown metric_key`);
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !team || !agent || !Number.isFinite(value)) {
      errors.push(`Line ${i + 1}: invalid date, team, agent, or value`);
      continue;
    }
    rows.push({ date, team, agent, metric_key, value });
  }
  return { rows, errors };
}

export function sampleCsv() {
  const keys = Object.keys(KPI_BY_KEY);
  const agents = [
    ["ncc", "Priya Shah"],
    ["ncc", "Marcus Chen"],
    ["voice", "Sam Okonkwo"],
    ["enterprise", "Avery Kim"],
  ];
  const lines = ["date,team,agent,metric_key,value"];
  const start = new Date();
  start.setDate(start.getDate() - 13);
  for (let d = 0; d < 14; d++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + d);
    const date = dt.toISOString().slice(0, 10);
    for (const [team, agent] of agents) {
      for (const key of keys) {
        let value = 0;
        if (key === "tickets_resolved") value = 18 + ((d + agent.length) % 12);
        else if (key === "aht_seconds") value = 240 + ((d * 7 + team.length) % 90);
        else value = 78 + ((d * 3 + agent.length) % 18);
        lines.push(`${date},${team},${agent},${key},${value}`);
      }
    }
  }
  return lines.join("\n");
}
