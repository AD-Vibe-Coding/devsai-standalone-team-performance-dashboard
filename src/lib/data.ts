import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, dbReady, schema } from "../db";
import type { ParsedRow } from "./parse-import";

function actor() {
  const role = (localStorage.getItem("tp_role") || "staff") === "manager" ? "manager" : "staff";
  const name = localStorage.getItem("tp_actor") || "Guest";
  return { role, name };
}

export async function loadOverview(team: string, from: string, to: string) {
  await dbReady;
  const cond = [
    from ? gte(schema.metric_records.period_date, from) : undefined,
    to ? lte(schema.metric_records.period_date, to) : undefined,
    team && team !== "all" ? eq(schema.metric_records.team_slug, team) : undefined,
  ].filter(Boolean) as Parameters<typeof and>[0][];

  const rows = await db
    .select()
    .from(schema.metric_records)
    .where(cond.length ? and(...cond) : undefined);

  const byKey: Record<string, number[]> = {};
  const byTeam: Record<string, Record<string, number[]>> = {};
  for (const r of rows) {
    (byKey[r.metric_key] ??= []).push(r.metric_value);
    byTeam[r.team_slug] ??= {};
    (byTeam[r.team_slug][r.metric_key] ??= []).push(r.metric_value);
  }
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const kpis = Object.fromEntries(
    Object.entries(byKey).map(([k, vals]) => [k, { value: avg(vals), n: vals.length }]),
  );
  const teams = Object.entries(byTeam).map(([slug, metrics]) => ({
    slug,
    metrics: Object.fromEntries(Object.entries(metrics).map(([k, vals]) => [k, avg(vals)])),
    n: Object.values(metrics)[0]?.length ?? 0,
  }));
  return { kpis, teams, rowCount: rows.length };
}

export async function loadTrends(team: string, from: string, to: string, metric: string) {
  await dbReady;
  const cond = [
    from ? gte(schema.metric_records.period_date, from) : undefined,
    to ? lte(schema.metric_records.period_date, to) : undefined,
    team && team !== "all" ? eq(schema.metric_records.team_slug, team) : undefined,
    metric ? eq(schema.metric_records.metric_key, metric) : undefined,
  ].filter(Boolean) as Parameters<typeof and>[0][];

  const rows = await db
    .select()
    .from(schema.metric_records)
    .where(cond.length ? and(...cond) : undefined);

  const bucket: Record<string, number[]> = {};
  for (const r of rows) {
    (bucket[r.period_date] ??= []).push(r.metric_value);
  }
  const series = Object.entries(bucket)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      [metric]: vals.reduce((a, b) => a + b, 0) / vals.length,
    }));
  return { series };
}

export async function loadMetrics(opts: {
  team: string;
  from: string;
  to: string;
  metric?: string;
  q?: string;
}) {
  await dbReady;
  const cond = [
    opts.from ? gte(schema.metric_records.period_date, opts.from) : undefined,
    opts.to ? lte(schema.metric_records.period_date, opts.to) : undefined,
    opts.team && opts.team !== "all" ? eq(schema.metric_records.team_slug, opts.team) : undefined,
    opts.metric ? eq(schema.metric_records.metric_key, opts.metric) : undefined,
  ].filter(Boolean) as Parameters<typeof and>[0][];

  let rows = await db
    .select()
    .from(schema.metric_records)
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(desc(schema.metric_records.period_date));

  const q = (opts.q || "").toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        r.agent_name.toLowerCase().includes(q) ||
        r.metric_key.toLowerCase().includes(q) ||
        r.team_slug.toLowerCase().includes(q),
    );
  }
  return rows.slice(0, 500);
}

export async function loadImports() {
  await dbReady;
  return db
    .select()
    .from(schema.import_batches)
    .orderBy(desc(schema.import_batches.created_at));
}

export async function runImport(filename: string, rows: ParsedRow[]) {
  await dbReady;
  const { role, name } = actor();
  if (role !== "manager") throw new Error("Managers only. Switch role in the header to import.");
  if (!rows.length) throw new Error("No rows to import");

  const dates = rows.map((r) => r.date).sort();
  const inserted = await db
    .insert(schema.import_batches)
    .values({
      filename,
      status: "imported",
      row_count: rows.length,
      error_summary: null,
      imported_by: name,
      period_start: dates[0],
      period_end: dates[dates.length - 1],
    })
    .returning();
  const batch = inserted[0];

  for (const r of rows) {
    await db.insert(schema.metric_records).values({
      period_date: r.date,
      team_slug: r.team,
      agent_name: r.agent,
      metric_key: r.metric_key,
      metric_value: r.value,
      import_id: batch.id,
    });
  }
  return { accepted: rows.length, errors: [] as string[] };
}

export async function loadDisputes() {
  await dbReady;
  return db.select().from(schema.disputes).orderBy(desc(schema.disputes.created_at));
}

export async function createDispute(metric_record_id: number, reason: string) {
  await dbReady;
  const { name } = actor();
  if (reason.trim().length < 8) throw new Error("Please describe the issue (8+ characters).");
  const [row] = await db
    .insert(schema.disputes)
    .values({
      metric_record_id,
      raised_by: name,
      reason: reason.trim(),
      status: "open",
    })
    .returning();
  return row;
}

export async function reviewDispute(id: number, status: "approved" | "rejected", review_note: string) {
  await dbReady;
  const { role, name } = actor();
  if (role !== "manager") throw new Error("Managers only. Switch role in the header to review.");
  const [row] = await db
    .update(schema.disputes)
    .set({ status, reviewer: name, review_note: review_note || null })
    .where(eq(schema.disputes.id, id))
    .returning();
  return row;
}
