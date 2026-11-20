import * as XLSX from "xlsx";
import { ROSTER } from "./roster";
import type { KpiKey } from "./kpis";
import type { VolumeKey } from "./volumes";

export type UploadKind = "tickets" | "mobility" | "calls";

export type UploadResult = {
  kind: UploadKind;
  filename: string;
  rows: number;
  used: number;
  errors: string[];
  volumes: Partial<Record<VolumeKey, number>>;
  kpis: Partial<Record<KpiKey, number>>;
  carriers: { name: string; tickets: number }[];
};

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

function toSeconds(raw: string): number | null {
  const t = raw.trim();
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
  if (n > 24 && n < 86400) return n;
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

export function parseWorkbook(kind: UploadKind, filename: string, buffer: ArrayBuffer): UploadResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const errors: string[] = [];
  const kpis: Partial<Record<KpiKey, number>> = {};
  const volumes: Partial<Record<VolumeKey, number>> = {};
  const carriers = new Map<string, number>();
  let used = 0;

  if (kind === "tickets") {
    const ack: number[] = [];
    let ackUnder5 = 0;
    let carrierOk = 0;
    let carrierN = 0;
    let closed24 = 0;
    let closedN = 0;
    const mttr: number[] = [];
    rows.forEach((row, i) => {
      const agent = cell(row, "acked by", "agent", "owner", "assignee");
      const ackSec = toSeconds(cell(row, "acked time", "ack time", "acknowledgement"));
      const carrierRaw = cell(row, "time to open ticket with the carrier", "carrier open", "carrier sla");
      const carrierName = cell(row, "carrier", "vendor");
      const closedRaw = cell(row, "closed under 24", "closed in 24", "mttr hours", "resolve time");
      const mttrSec = toSeconds(cell(row, "mttr", "restore time", "time to restore"));
      if (!agent && ackSec == null && !carrierRaw) {
        if (i < 5) errors.push(`Row ${i + 2}: no ticket fields recognized`);
        return;
      }
      used += 1;
      if (ackSec != null) {
        ack.push(ackSec);
        if (ackSec < 300) ackUnder5 += 1;
      }
      const onTime = yesNo(carrierRaw);
      if (onTime != null) {
        carrierN += 1;
        if (onTime) carrierOk += 1;
      } else {
        const secs = toSeconds(carrierRaw);
        if (secs != null) {
          carrierN += 1;
          if (secs > 0) carrierOk += 1;
        }
      }
      if (carrierName) carriers.set(carrierName, (carriers.get(carrierName) ?? 0) + 1);
      const closedFlag = yesNo(closedRaw);
      if (closedFlag != null) {
        closedN += 1;
        if (closedFlag) closed24 += 1;
      }
      if (mttrSec != null) mttr.push(mttrSec);
    });
    volumes.tickets_received = used;
    if (ack.length) {
      kpis.avg_ack_seconds = ack.reduce((a, b) => a + b, 0) / ack.length;
      kpis.ack_under_5_pct = (ackUnder5 / ack.length) * 100;
    }
    if (carrierN) kpis.carrier_open_sla_pct = (carrierOk / carrierN) * 100;
    if (closedN) kpis.closed_under_24h_pct = (closed24 / closedN) * 100;
    if (mttr.length) kpis.avg_mttr_seconds = mttr.reduce((a, b) => a + b, 0) / mttr.length;
  }

  if (kind === "mobility") {
    let ok = 0;
    rows.forEach((row, i) => {
      const dur = toSeconds(cell(row, "duration", "handle time", "minutes", "elapsed"));
      const sla = yesNo(cell(row, "sla", "met", "under 60"));
      if (dur == null && sla == null) {
        if (i < 5) errors.push(`Row ${i + 2}: no mobility fields recognized`);
        return;
      }
      used += 1;
      if (sla != null) {
        if (sla) ok += 1;
      } else if (dur != null && dur <= 3600) ok += 1;
    });
    volumes.mobility_tasks = used;
    if (used) kpis.mobility_sla_pct = (ok / used) * 100;
  }

  if (kind === "calls") {
    let inbound = 0;
    let outbound = 0;
    const asa: number[] = [];
    let refused = 0;
    rows.forEach((row, i) => {
      const dir = direction(cell(row, "direction", "type", "call type"));
      const asaSec = toSeconds(cell(row, "asa", "speed of answer", "answer time"));
      const refusedFlag = yesNo(cell(row, "refused", "abandoned"));
      if (!dir && asaSec == null && refusedFlag == null) {
        if (i < 5) errors.push(`Row ${i + 2}: no call fields recognized`);
        return;
      }
      used += 1;
      if (dir === "inbound") inbound += 1;
      else if (dir === "outbound") outbound += 1;
      else inbound += 1;
      if (asaSec != null) asa.push(asaSec);
      if (refusedFlag) refused += 1;
    });
    volumes.inbound_calls = inbound;
    volumes.outbound_calls = outbound;
    if (asa.length) kpis.asa_seconds = asa.reduce((a, b) => a + b, 0) / asa.length;
    kpis.refused_calls = refused;
  }

  void ROSTER;
  return {
    kind,
    filename,
    rows: rows.length,
    used,
    errors: errors.slice(0, 12),
    volumes,
    kpis,
    carriers: [...carriers.entries()].map(([name, tickets]) => ({ name, tickets })),
  };
}
