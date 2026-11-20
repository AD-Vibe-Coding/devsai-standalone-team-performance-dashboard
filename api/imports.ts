import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "./_lib/supabase-admin.js";
import { requireManager, actorFrom } from "./_lib/auth.js";

const KEYS = new Set([
  "tickets_resolved",
  "csat",
  "sla_met",
  "aht_seconds",
  "fcr",
  "occupancy",
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("import_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data ?? []);
    }

    if (req.method === "POST") {
      const actor = requireManager(req, res);
      if (!actor) return;

      const filename = String(req.body?.filename ?? "upload.csv");
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      if (!rows.length) return res.status(400).json({ error: "No rows to import" });

      const errors: string[] = [];
      const valid: {
        period_date: string;
        team_slug: string;
        agent_name: string;
        metric_key: string;
        metric_value: number;
      }[] = [];

      rows.forEach((row: Record<string, unknown>, i: number) => {
        const date = String(row.date ?? row.period_date ?? "").slice(0, 10);
        const team = String(row.team ?? row.team_slug ?? "").trim().toLowerCase();
        const agent = String(row.agent ?? row.agent_name ?? "").trim();
        const key = String(row.metric_key ?? row.metric ?? "").trim();
        const value = Number(row.value ?? row.metric_value);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`Row ${i + 1}: date must be YYYY-MM-DD`);
        if (!team) errors.push(`Row ${i + 1}: team is required`);
        if (!agent) errors.push(`Row ${i + 1}: agent is required`);
        if (!KEYS.has(key)) errors.push(`Row ${i + 1}: unknown metric_key "${key}"`);
        if (!Number.isFinite(value)) errors.push(`Row ${i + 1}: value must be numeric`);
        if (errors.length > 40) return;
        if (
          /^\d{4}-\d{2}-\d{2}$/.test(date) &&
          team &&
          agent &&
          KEYS.has(key) &&
          Number.isFinite(value)
        ) {
          valid.push({
            period_date: date,
            team_slug: team,
            agent_name: agent,
            metric_key: key,
            metric_value: value,
          });
        }
      });

      const status = valid.length && errors.length === 0 ? "imported" : valid.length ? "partial" : "failed";
      const dates = valid.map((v) => v.period_date).sort();

      const { data: batch, error: bErr } = await supabaseAdmin
        .from("import_batches")
        .insert({
          filename,
          status,
          row_count: valid.length,
          error_summary: errors.slice(0, 20).join(" | ") || null,
          imported_by: actor.name,
          period_start: dates[0] ?? null,
          period_end: dates[dates.length - 1] ?? null,
        })
        .select()
        .single();
      if (bErr) return res.status(500).json({ error: bErr.message });

      if (valid.length) {
        const payload = valid.map((v) => ({ ...v, import_id: batch.id }));
        const { error: mErr } = await supabaseAdmin.from("metric_records").insert(payload);
        if (mErr) return res.status(500).json({ error: mErr.message });
      }

      return res.status(201).json({ batch, accepted: valid.length, errors: errors.slice(0, 20) });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
}
