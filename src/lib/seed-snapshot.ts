import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../db/schema";
import { ROSTER } from "./roster";
import type { KpiKey } from "./kpis";

const STAFF = ROSTER.filter((p) => p.role === "staff");

/** Stable snapshot so the home dashboard is filled on first open. */
const SNAPSHOT: Record<string, Partial<Record<KpiKey, number>>> = {
  "Priya Shah": {
    avg_ack_seconds: 95,
    ack_under_5_pct: 94.2,
    carrier_open_sla_pct: 96.1,
    refused_calls: 0,
    asa_seconds: 5.2,
    mobility_sla_pct: 97.4,
  },
  "Marcus Chen": {
    avg_ack_seconds: 142,
    ack_under_5_pct: 88.5,
    carrier_open_sla_pct: 91.3,
    refused_calls: 1,
    asa_seconds: 6.8,
    mobility_sla_pct: 92.1,
  },
  "Sam Okonkwo": {
    avg_ack_seconds: 168,
    ack_under_5_pct: 86.0,
    carrier_open_sla_pct: 89.4,
    refused_calls: 2,
    asa_seconds: 7.4,
    mobility_sla_pct: 90.8,
  },
  "Avery Kim": {
    avg_ack_seconds: 118,
    ack_under_5_pct: 91.7,
    carrier_open_sla_pct: 93.8,
    refused_calls: 0,
    asa_seconds: 4.9,
    mobility_sla_pct: 95.2,
  },
};

export function snapshotLeaderboards(): Record<string, { agent: string; team: string; value: number }[]> {
  const boards: Record<string, { agent: string; team: string; value: number }[]> = {};
  for (const person of STAFF) {
    const base = SNAPSHOT[person.name];
    if (!base) continue;
    for (const [key, value] of Object.entries(base)) {
      (boards[key] ??= []).push({ agent: person.name, team: person.tier, value: value as number });
    }
  }
  return boards;
}

export function snapshotOverview() {
  const boards = snapshotLeaderboards();
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const kpis = Object.fromEntries(
    Object.entries(boards).map(([k, rows]) => [k, { value: avg(rows.map((r) => r.value)), n: rows.length }]),
  );
  const byTeam: Record<string, Record<string, number[]>> = {};
  for (const [key, rows] of Object.entries(boards)) {
    for (const r of rows) {
      byTeam[r.team] ??= {};
      (byTeam[r.team][key] ??= []).push(r.value);
    }
  }
  const teams = Object.entries(byTeam).map(([slug, metrics]) => ({
    slug,
    metrics: Object.fromEntries(Object.entries(metrics).map(([k, vals]) => [k, avg(vals)])),
    n: Object.values(metrics)[0]?.length ?? 0,
  }));
  const rowCount = Object.values(boards).reduce((n, rows) => n + rows.length, 0);
  return { kpis, teams, rowCount };
}

export async function seedSnapshotIfEmpty(
  db: ReturnType<typeof drizzle<typeof schema>>,
) {
  const existing = await db.execute(
    sql`SELECT COUNT(*)::int AS n FROM metric_records WHERE metric_key IN ('avg_ack_seconds','asa_seconds','mobility_sla_pct')`,
  );
  const n = Number((existing.rows?.[0] as { n?: number } | undefined)?.n ?? 0);
  if (n > 0) return;

  const today = new Date();
  const dates: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const [batch] = await db
    .insert(schema.import_batches)
    .values({
      filename: "snapshot-seed.csv",
      status: "imported",
      row_count: 0,
      error_summary: "Demo snapshot — replace by importing a live export.",
      imported_by: "System",
      period_start: dates[0],
      period_end: dates[dates.length - 1],
    })
    .returning();

  let count = 0;
  for (const date of dates) {
    const dayIndex = dates.indexOf(date);
    for (const person of STAFF) {
      const base = SNAPSHOT[person.name];
      if (!base) continue;
      const wobble = ((dayIndex + person.name.length) % 5) - 2;
      const rows: { key: KpiKey; value: number }[] = [
        { key: "avg_ack_seconds", value: Math.max(60, (base.avg_ack_seconds ?? 120) + wobble * 8) },
        { key: "ack_under_5_pct", value: clampPct((base.ack_under_5_pct ?? 90) - wobble * 0.4) },
        { key: "carrier_open_sla_pct", value: clampPct((base.carrier_open_sla_pct ?? 90) - wobble * 0.3) },
        { key: "refused_calls", value: Math.max(0, (base.refused_calls ?? 0) + (dayIndex === 3 ? 1 : 0) - (dayIndex === 9 ? 1 : 0)) },
        { key: "asa_seconds", value: Math.max(3, (base.asa_seconds ?? 6) + wobble * 0.15) },
        { key: "mobility_sla_pct", value: clampPct((base.mobility_sla_pct ?? 90) - wobble * 0.25) },
      ];
      for (const r of rows) {
        await db.insert(schema.metric_records).values({
          period_date: date,
          team_slug: person.tier,
          agent_name: person.name,
          metric_key: r.key,
          metric_value: r.value,
          import_id: batch.id,
        });
        count += 1;
      }
    }
  }

  await db.execute(
    sql`UPDATE import_batches SET row_count = ${count} WHERE id = ${batch.id}`,
  );
}

function clampPct(v: number) {
  return Math.min(99.9, Math.max(70, Number(v.toFixed(1))));
}
