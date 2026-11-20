import { REQUIRED_IMPORT_COLUMNS, type KpiKey, KPI_BY_KEY, IMPORT_KPI_DEFS } from "./kpis";
import { ROSTER } from "./roster";

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

/** Excel 1-based letters → 0-based index. A=0 … Z=25, AA=26, AK=36, W=22. */
const COL = {
  W: 22, // Time to open ticket with the carrier
  Z: 25, // Ticket Acked time
  AA: 26, // Ticket Acked By
  AK: 36, // Date
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

function looksLikeMetricCsv(header: string[]) {
  return REQUIRED_IMPORT_COLUMNS.every((c) => header.includes(c));
}

function looksLikeTicketExport(table: string[][]) {
  const width = Math.max(...table.map((r) => r.length));
  return width > COL.AK;
}

function parseDate(raw: string): string | null {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const mdy = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (mdy) {
    const mo = mdy[1].padStart(2, "0");
    const d = mdy[2].padStart(2, "0");
    let y = mdy[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo}-${d}`;
  }
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/** Duration → seconds. Accepts h:mm:ss, m:ss, minutes, or seconds. */
function parseDurationSeconds(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{1,2}:\d{2}:\d{2}(\.\d+)?$/.test(t)) {
    const [h, m, s] = t.split(":").map(Number);
    return h * 3600 + m * 60 + s;
  }
  if (/^\d{1,3}:\d{2}(\.\d+)?$/.test(t)) {
    const [m, s] = t.split(":").map(Number);
    return m * 60 + s;
  }
  const n = Number(t.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  // Values over 24 treated as seconds; otherwise minutes (typical ticket exports).
  if (n > 24 && n < 86400) return n;
  return n * 60;
}

function carrierOnTime(raw: string): boolean | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (["y", "yes", "true", "1", "met", "on time", "ontime", "pass"].includes(t)) return true;
  if (["n", "no", "false", "0", "missed", "fail", "late"].includes(t)) return false;
  const pct = Number(t.replace("%", ""));
  if (Number.isFinite(pct) && pct >= 0 && pct <= 100) return pct >= 90;
  const secs = parseDurationSeconds(raw);
  if (secs == null) return null;
  return secs > 0;
}

function teamForAgent(name: string) {
  const p = ROSTER.find((r) => r.name.toLowerCase() === name.toLowerCase());
  return p?.tier ?? "tier-1";
}

function parseMetricCsv(table: string[][]): ParseResult {
  const header = table[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
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

type Bucket = {
  date: string;
  team: string;
  agent: string;
  ackSeconds: number[];
  ackUnder5: number;
  ackTotal: number;
  carrierOk: number;
  carrierTotal: number;
};

function parseTicketExport(table: string[][]): ParseResult {
  const errors: string[] = [];
  const buckets = new Map<string, Bucket>();
  const start = table[0].some((h) => /acked|date|carrier/i.test(h)) ? 1 : 0;

  for (let i = start; i < table.length; i++) {
    const cells = table[i];
    const date = parseDate(cells[COL.AK] || "");
    const agent = (cells[COL.AA] || "").trim();
    if (!date || !agent) {
      errors.push(`Line ${i + 1}: missing date (AK) or Ticket Acked By (AA)`);
      continue;
    }
    const team = teamForAgent(agent);
    const key = `${date}|${team}|${agent}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        date,
        team,
        agent,
        ackSeconds: [],
        ackUnder5: 0,
        ackTotal: 0,
        carrierOk: 0,
        carrierTotal: 0,
      };
      buckets.set(key, b);
    }

    const ack = parseDurationSeconds(cells[COL.Z] || "");
    if (ack != null) {
      b.ackSeconds.push(ack);
      b.ackTotal += 1;
      if (ack < 300) b.ackUnder5 += 1;
    }

    const carrier = carrierOnTime(cells[COL.W] || "");
    if (carrier != null) {
      b.carrierTotal += 1;
      if (carrier) b.carrierOk += 1;
    }
  }

  const rows: ParsedRow[] = [];
  for (const b of buckets.values()) {
    if (b.ackSeconds.length) {
      const mean = b.ackSeconds.reduce((a, c) => a + c, 0) / b.ackSeconds.length;
      rows.push({
        date: b.date,
        team: b.team,
        agent: b.agent,
        metric_key: "avg_ack_seconds",
        value: mean,
      });
      rows.push({
        date: b.date,
        team: b.team,
        agent: b.agent,
        metric_key: "ack_under_5_pct",
        value: (b.ackUnder5 / b.ackTotal) * 100,
      });
    }
    if (b.carrierTotal) {
      rows.push({
        date: b.date,
        team: b.team,
        agent: b.agent,
        metric_key: "carrier_open_sla_pct",
        value: (b.carrierOk / b.carrierTotal) * 100,
      });
    }
  }

  if (!rows.length) {
    errors.push(
      "Ticket export had no usable ack (Z) or carrier-open (W) values. Refused calls, ASA, and Mobility still need their own columns.",
    );
  }
  return { rows, errors: errors.slice(0, 40) };
}

export function parseImportText(text: string): ParseResult {
  const table = splitCsv(text);
  if (!table.length) return { rows: [], errors: ["File is empty"] };
  const header = table[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  if (looksLikeMetricCsv(header)) return parseMetricCsv(table);
  if (looksLikeTicketExport(table)) return parseTicketExport(table);
  return {
    rows: [],
    errors: [
      `Unrecognized file. Use metric CSV (${REQUIRED_IMPORT_COLUMNS.join(", ")}) or a ticket export with date in AK, Ticket Acked By in AA, Ticket Acked time in Z, Time to open with carrier in W.`,
    ],
  };
}

export function sampleCsv() {
  const keys = IMPORT_KPI_DEFS.map((k) => k.key);
  const agents = [
    ["tier-1", "Priya Shah"],
    ["tier-2", "Marcus Chen"],
    ["tier-2", "Sam Okonkwo"],
    ["tier-3", "Avery Kim"],
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
        const salt = d + agent.length + team.length;
        let value = 0;
        if (key === "avg_ack_seconds") value = 90 + (salt % 120);
        else if (key === "ack_under_5_pct") value = 82 + (salt % 16);
        else if (key === "carrier_open_sla_pct") value = 88 + (salt % 12);
        else if (key === "refused_calls") value = salt % 3 === 0 ? 2 : salt % 2;
        else if (key === "asa_seconds") value = 4 + (salt % 7);
        else if (key === "mobility_sla_pct") value = 86 + (salt % 14);
        lines.push(`${date},${team},${agent},${key},${value}`);
      }
    }
  }
  return lines.join("\n");
}
