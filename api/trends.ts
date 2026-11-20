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
    const metric = String(req.query.metric ?? "");

    let q = supabaseAdmin.from("metric_records").select("period_date, team_slug, metric_key, metric_value");
    if (team && team !== "all") q = q.eq("team_slug", team);
    if (from) q = q.gte("period_date", from);
    if (to) q = q.lte("period_date", to);
    if (metric) q = q.eq("metric_key", metric);

    const { data, error } = await q.order("period_date", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    const bucket: Record<string, Record<string, number[]>> = {};
    for (const r of data ?? []) {
      const d = r.period_date as string;
      const k = r.metric_key as string;
      bucket[d] ??= {};
      (bucket[d][k] ??= []).push(Number(r.metric_value));
    }

    const series = Object.entries(bucket)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, metrics]) => ({
        date,
        ...Object.fromEntries(
          Object.entries(metrics).map(([k, vals]) => [
            k,
            vals.reduce((a, b) => a + b, 0) / vals.length,
          ]),
        ),
      }));

    return res.status(200).json({ series });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
}
