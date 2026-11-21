import * as XLSX from "xlsx";
import type { KpiKey } from "./kpis";
import type { VolumeKey } from "./volumes";
import { matchTeamMember } from "./team-members";

export type UploadKind = "tickets" | "mobility" | "calls";

export type MonthSlice = {
  monthKey: string;
  monthLabel: string;
  volumes: Partial<Record<VolumeKey, number>>;
  kpis: Partial<Record<KpiKey, number>>;
  carriers: { name: string; tickets: number }[];
  used: number;
};

export type UploadResult = {
  kind: UploadKind;
  filename: string;
  rows: number;
  used: number;
  errors: string[];
  volumes: Partial<Record<VolumeKey, number>>;
  kpis: Partial<Record<KpiKey, number>>;
  carriers: { name: string; tickets: number }[];
  months: MonthSlice[];
  /** Per-roster-member month slices (tickets attributed via Acked By / agent). */
  members: Record<string, MonthSlice[]>;
};

const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function parseMonthKey(raw: unknown): { key: string; label: string } | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = raw.getMonth() + 1;
    return { key: `${y}-${pad2(m)}`, label: monthLabel(y, m) };
  }
  const t = String(raw).trim();
  if (!t) return null;
  const excelSerial = Number(t);
  if (Number.isFinite(excelSerial) && excelSerial > 30000 && excelSerial < 60000) {
    const d = new Date(Math.round((excelSerial - 25569) * 86400 * 1000));
    if (!Number.isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      return { key: `${y}-${pad2(m)}`, label: monthLabel(y, m) };
    }
  }
  const iso = t.match(/^(\d{4})[-/](\d{1,2})/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    if (m >= 1 && m <= 12) return { key: `${y}-${pad2(m)}`, label: monthLabel(y, m) };
  }
  const us = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (us) {
    let y = Number(us[3]);
    if (y < 100) y += 2000;
    const m = Number(us[1]) > 12 ? Number(us[2]) : Number(us[1]);
    if (m >= 1 && m <= 12) return { key: `${y}-${pad2(m)}`, label: monthLabel(y, m) };
  }
  const named = t.match(/([A-Za-z]{3,9})\s*[,-]?\s*(\d{2,4})/);
  if (named) {
    const mi = MONTH_NAMES.findIndex((n) => named[1].toLowerCase().startsWith(n));
    if (mi >= 0) {
      let y = Number(named[2]);
      if (y < 100) y += 2000;
      return { key: `${y}-${pad2(mi + 1)}`, label: monthLabel(y, mi + 1) };
    }
  }
  const dash = t.match(/^(\d{4})(\d{2})$/);
  if (dash) {
    const y = Number(dash[1]);
    const m = Number(dash[2]);
    if (m >= 1 && m <= 12) return { key: `${y}-${pad2(m)}`, label: monthLabel(y, m) };
  }
  return null;
}

function monthLabel(year: number, month: number) {
  const short = MONTH_NAMES[month - 1];
  const yy = String(year).slice(-2);
  const pretty = short ? short[0].toUpperCase() + short.slice(1) : String(month);
  return `${pretty} ${yy}`;
}

export function monthKeyFromLabel(label: string): string | null {
  const named = label.match(/([A-Za-z]{3})\s+(\d{2})/);
  if (!named) return null;
  const mi = MONTH_NAMES.findIndex((n) => named[1].toLowerCase().startsWith(n));
  if (mi < 0) return null;
  const y = 2000 + Number(named[2]);
  return `${y}-${pad2(mi + 1)}`;
}

export function quarterKeyFromLabel(label: string): string[] {
  const m = label.match(/Q(\d)\s+(\d{2})/);
  if (!m) return [];
  const q = Number(m[1]);
  const y = 2000 + Number(m[2]);
  const start = (q - 1) * 3 + 1;
  return [0, 1, 2].map((i) => `${y}-${pad2(start + i)}`);
}

function cell(row: Record<string, unknown>, ...names: string[]) {
  const keys = Object.keys(row);
  for (const name of names) {
    const want = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hit = keys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, "") === want);
    if (hit != null && row[hit] != null && String(row[hit]).trim() !== "") return String(row[hit]).trim();
  }
  for (const name of names) {
    const want = name.toLowerCase();
    const hit = keys.find((k) => k.toLowerCase().includes(want));
    if (hit != null && row[hit] != null && String(row[hit]).trim() !== "") return String(row[hit]).trim();
  }
  return "";
}

function toSeconds(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.getUTCHours() * 3600 + raw.getUTCMinutes() * 60 + raw.getUTCSeconds();
  }
  const t = String(raw).trim();
  if (!t) return null;
  if (/^\d{1,2}:\d{2}:\d{2}/.test(t)) {
    const [h, m, s] = t.split(":").map(Number);
    return h * 3600 + m * 60 + s;
  }
  if (/^\d{1,3}:\d{2}/.test(t)) {
    const [m, s] = t.split(":").map(Number);
    return m * 60 + s;
  }
  const n = Number(t.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  if (n > 0 && n < 1) return n * 86400;
  if (n > 24 && n < 86400) return n;
  return n * 60;
}

/** Column AN "Ticket Acknowledge Time" is minutes (1, 8, 13…) or Excel time. */
function ackMinutesToSeconds(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.getUTCHours() * 3600 + raw.getUTCMinutes() * 60 + raw.getUTCSeconds();
  }
  const t = String(raw).trim();
  if (!t) return null;
  if (/^\d{1,2}:\d{2}:\d{2}/.test(t)) {
    const [h, m, s] = t.split(":").map(Number);
    return h * 3600 + m * 60 + s;
  }
  if (/^\d{1,3}:\d{2}/.test(t)) {
    const [m, s] = t.split(":").map(Number);
    return m * 60 + s;
  }
  const n = Number(t.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  if (n > 0 && n < 1) return n * 86400;
  return n * 60;
}

function yesNo(raw: string): boolean | null {
  const t = raw.toLowerCase();
  if (!t) return null;
  if (["y", "yes", "true", "1", "met", "on time", "ontime", "pass"].includes(t)) return true;
  if (["n", "no", "false", "0", "missed", "fail", "late"].includes(t)) return false;
  return null;
}

function direction(raw: string): "inbound" | "outbound" | null {
  const t = raw.toLowerCase();
  if (t.includes("in")) return "inbound";
  if (t.includes("out")) return "outbound";
  return null;
}

type Acc = {
  used: number;
  ack: number[];
  ackUnder5: number;
  carrierOk: number;
  carrierN: number;
  closed24: number;
  closedN: number;
  mttr: number[];
  mobilityOk: number;
  mobilityN: number;
  inbound: number;
  outbound: number;
  asa: number[];
  refused: number;
  carriers: Map<string, number>;
};

function emptyAcc(): Acc {
  return {
    used: 0,
    ack: [],
    ackUnder5: 0,
    carrierOk: 0,
    carrierN: 0,
    closed24: 0,
    closedN: 0,
    mttr: [],
    mobilityOk: 0,
    mobilityN: 0,
    inbound: 0,
    outbound: 0,
    asa: [],
    refused: 0,
    carriers: new Map(),
  };
}

function finish(kind: UploadKind, acc: Acc): { volumes: MonthSlice["volumes"]; kpis: MonthSlice["kpis"]; carriers: MonthSlice["carriers"] } {
  const volumes: MonthSlice["volumes"] = {};
  const kpis: MonthSlice["kpis"] = {};
  if (kind === "tickets") {
    volumes.tickets_received = acc.used;
    if (acc.ack.length) {
      kpis.avg_ack_seconds = acc.ack.reduce((a, b) => a + b, 0) / acc.ack.length;
      kpis.ack_under_5_pct = (acc.ackUnder5 / acc.ack.length) * 100;
    }
    if (acc.carrierN) kpis.carrier_open_sla_pct = (acc.carrierOk / acc.carrierN) * 100;
    if (acc.closedN) kpis.closed_under_24h_pct = (acc.closed24 / acc.closedN) * 100;
    if (acc.mttr.length) kpis.avg_mttr_seconds = acc.mttr.reduce((a, b) => a + b, 0) / acc.mttr.length;
  }
  if (kind === "mobility") {
    volumes.mobility_tasks = acc.used;
    if (acc.used) kpis.mobility_sla_pct = (acc.mobilityOk / acc.used) * 100;
  }
  if (kind === "calls") {
    volumes.inbound_calls = acc.inbound;
    volumes.outbound_calls = acc.outbound;
    if (acc.asa.length) kpis.asa_seconds = acc.asa.reduce((a, b) => a + b, 0) / acc.asa.length;
    kpis.refused_calls = acc.refused;
  }
  return {
    volumes,
    kpis,
    carriers: [...acc.carriers.entries()].map(([name, tickets]) => ({ name, tickets })),
  };
}

function headerIndex(headers: string[], ...names: string[]): number {
  for (const name of names) {
    const want = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const i = headers.findIndex((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "") === want);
    if (i >= 0) return i;
  }
  for (const name of names) {
    const want = name.toLowerCase();
    const i = headers.findIndex((h) => h.toLowerCase().includes(want));
    if (i >= 0) return i;
  }
  return -1;
}

export function parseWorkbook(kind: UploadKind, filename: string, buffer: ArrayBuffer): UploadResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date)[]>(sheet, { header: 1, defval: "", raw: true });
  const headerRow = (matrix[0] ?? []).map((h) => String(h || "").trim());
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const errors: string[] = [];
  const byMonth = new Map<string, { label: string; acc: Acc }>();
  const byMemberMonth = new Map<string, Map<string, { label: string; acc: Acc }>>();
  const total = emptyAcc();
  let used = 0;

  const ackCol = (() => {
    const named = headerIndex(headerRow, "ticket acknowledge time", "acknowledge time", "acked time");
    return named >= 0 ? named : 39;
  })();
  // Column AG (A=0 … AG=32): time to open ticket with the carrier, in minutes.
  const carrierCol = (() => {
    const named = headerIndex(
      headerRow,
      "time to open ticket with the carrier",
      "carrier open",
      "open ticket with the carrier",
    );
    return named >= 0 ? named : 32;
  })();

  const dataRows = matrix.slice(1);

  dataRows.forEach((grid, i) => {
    const monthRaw = grid[1];
    const parsedMonth = parseMonthKey(monthRaw);
    if (!parsedMonth) {
      if (i < 8) errors.push(`Row ${i + 2}: column B is not a recognizable month (${String(monthRaw)})`);
      return;
    }

    const acc = byMonth.get(parsedMonth.key)?.acc ?? emptyAcc();
    if (!byMonth.has(parsedMonth.key)) byMonth.set(parsedMonth.key, { label: parsedMonth.label, acc });

    const row = rows[i] ?? {};

    if (kind === "tickets") {
      const agent = cell(row, "acked by", "agent", "owner", "assignee");
      const ackSec = ackMinutesToSeconds(grid[ackCol]);
      const carrierCell = grid[carrierCol];
      const carrierBlank =
        carrierCell == null || String(carrierCell).trim() === "";
      const carrierSec = carrierBlank ? null : ackMinutesToSeconds(carrierCell);
      const carrierName = cell(row, "carrier", "vendor");
      const closedRaw = cell(row, "closed under 24", "closed in 24", "mttr hours", "resolve time");
      const mttrSec = toSeconds(cell(row, "mttr", "restore time", "time to restore"));
      if (!agent && ackSec == null && carrierSec == null && !carrierName && mttrSec == null) {
        if (i < 5) errors.push(`Row ${i + 2}: no ticket fields recognized`);
        return;
      }
      used += 1;
      acc.used += 1;
      total.used += 1;
      const memberName = matchTeamMember(agent);
      let mAcc: Acc | null = null;
      if (memberName) {
        let mmap = byMemberMonth.get(memberName);
        if (!mmap) {
          mmap = new Map();
          byMemberMonth.set(memberName, mmap);
        }
        const slot = mmap.get(parsedMonth.key) ?? { label: parsedMonth.label, acc: emptyAcc() };
        if (!mmap.has(parsedMonth.key)) mmap.set(parsedMonth.key, slot);
        mAcc = slot.acc;
        mAcc.used += 1;
      }
      if (ackSec != null) {
        acc.ack.push(ackSec);
        total.ack.push(ackSec);
        mAcc?.ack.push(ackSec);
        if (ackSec < 300) {
          acc.ackUnder5 += 1;
          total.ackUnder5 += 1;
          if (mAcc) mAcc.ackUnder5 += 1;
        }
      }
      // AG: minutes to open with carrier. Blank cells excluded. Under 15 min = on time.
      if (carrierSec != null) {
        acc.carrierN += 1;
        total.carrierN += 1;
        if (mAcc) mAcc.carrierN += 1;
        if (carrierSec < 15 * 60) {
          acc.carrierOk += 1;
          total.carrierOk += 1;
          if (mAcc) mAcc.carrierOk += 1;
        }
      }
      if (carrierName) {
        acc.carriers.set(carrierName, (acc.carriers.get(carrierName) ?? 0) + 1);
        total.carriers.set(carrierName, (total.carriers.get(carrierName) ?? 0) + 1);
        if (mAcc) mAcc.carriers.set(carrierName, (mAcc.carriers.get(carrierName) ?? 0) + 1);
      }
      const closedFlag = yesNo(closedRaw);
      if (closedFlag != null) {
        acc.closedN += 1;
        total.closedN += 1;
        if (mAcc) mAcc.closedN += 1;
        if (closedFlag) {
          acc.closed24 += 1;
          total.closed24 += 1;
          if (mAcc) mAcc.closed24 += 1;
        }
      }
      if (mttrSec != null) {
        acc.mttr.push(mttrSec);
        total.mttr.push(mttrSec);
        mAcc?.mttr.push(mttrSec);
      }
    }

    if (kind === "mobility") {
      const dur = toSeconds(cell(row, "duration", "handle time", "minutes", "elapsed"));
      const sla = yesNo(cell(row, "sla", "met", "under 60"));
      if (dur == null && sla == null) {
        if (i < 5) errors.push(`Row ${i + 2}: no mobility fields recognized`);
        return;
      }
      used += 1;
      acc.used += 1;
      if (sla != null) {
        if (sla) acc.mobilityOk += 1;
      } else if (dur != null && dur <= 3600) acc.mobilityOk += 1;
    }

    if (kind === "calls") {
      const dir = direction(cell(row, "direction", "type", "call type"));
      const asaSec = toSeconds(cell(row, "asa", "speed of answer", "answer time"));
      const refusedFlag = yesNo(cell(row, "refused", "abandoned"));
      if (!dir && asaSec == null && refusedFlag == null) {
        if (i < 5) errors.push(`Row ${i + 2}: no call fields recognized`);
        return;
      }
      used += 1;
      acc.used += 1;
      total.used += 1;
      if (dir === "inbound") {
        acc.inbound += 1;
        total.inbound += 1;
      } else if (dir === "outbound") {
        acc.outbound += 1;
        total.outbound += 1;
      } else {
        acc.inbound += 1;
        total.inbound += 1;
      }
      if (asaSec != null) {
        acc.asa.push(asaSec);
        total.asa.push(asaSec);
      }
      if (refusedFlag) {
        acc.refused += 1;
        total.refused += 1;
      }
    }
  });

  const months: MonthSlice[] = [...byMonth.entries()].map(([monthKey, { label, acc }]) => {
    const done = finish(kind, acc);
    return { monthKey, monthLabel: label, used: acc.used, ...done };
  });

  const totals = finish(kind, total);

  const members: Record<string, MonthSlice[]> = {};
  for (const [name, mmap] of byMemberMonth.entries()) {
    members[name] = [...mmap.entries()].map(([monthKey, { label, acc }]) => {
      const done = finish(kind, acc);
      return { monthKey, monthLabel: label, used: acc.used, ...done };
    });
  }

  return {
    kind,
    filename,
    rows: rows.length,
    used,
    errors: errors.slice(0, 12),
    volumes: totals.volumes,
    kpis: totals.kpis,
    carriers: totals.carriers,
    months,
    members,
  };
}
