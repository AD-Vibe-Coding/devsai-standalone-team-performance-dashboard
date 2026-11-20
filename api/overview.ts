import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "./_lib/supabase-admin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }
    const team = String(req.query.team ?? "all");
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");

    let q = supabaseAdmin.from("metric_records").select("*");
    if (team && team !== "all") q = q.eq("team_slug", team);
    if (from) q = q.gte("period_date", from);
    if (to) q = q.lte("period_date", to);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    const rows = data ?? [];
    const byKey: Record<string, number[]> = {};
    const byTeam: Record<string, Record<string, number[]>> = {};

    for (const r of rows) {
      const k = r.metric_key as string;
      const t = r.team_slug as string;
      const v = Number(r.metric_value);
      (byKey[k] ??= []).push(v);
      byTeam[t] ??= {};
      (byTeam[t][k] ??= []).push(v);
    }

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const kpis = Object.fromEntries(
      Object.entries(byKey).map(([k, vals]) => [k, { value: avg(vals), n: vals.length }]),
    );

    const teams = Object.entries(byTeam).map(([slug, metrics]) => ({
      slug,
      metrics: Object.fromEntries(
        Object.entries(metrics).map(([k, vals]) => [k, avg(vals)]),
      ),
      n: Object.values(metrics)[0]?.length ?? 0,
    }));

    return res.status(200).json({ kpis, teams, rowCount: rows.length });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
}
