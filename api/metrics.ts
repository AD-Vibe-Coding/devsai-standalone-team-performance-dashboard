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
    const agent = String(req.query.agent ?? "");
    const qtext = String(req.query.q ?? "").toLowerCase();

    let q = supabaseAdmin.from("metric_records").select("*");
    if (team && team !== "all") q = q.eq("team_slug", team);
    if (from) q = q.gte("period_date", from);
    if (to) q = q.lte("period_date", to);
    if (metric) q = q.eq("metric_key", metric);
    if (agent) q = q.ilike("agent_name", `%${agent}%`);

    const { data, error } = await q.order("period_date", { ascending: false }).limit(500);
    if (error) return res.status(500).json({ error: error.message });

    let rows = data ?? [];
    if (qtext) {
      rows = rows.filter(
        (r) =>
          String(r.agent_name).toLowerCase().includes(qtext) ||
          String(r.metric_key).toLowerCase().includes(qtext) ||
          String(r.team_slug).toLowerCase().includes(qtext),
      );
    }
    return res.status(200).json(rows);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
}
