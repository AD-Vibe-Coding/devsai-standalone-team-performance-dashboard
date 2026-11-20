import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "./_lib/supabase-admin.js";
import { actorFrom } from "./_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      const status = String(req.query.status ?? "");
      let q = supabaseAdmin.from("disputes").select("*").order("created_at", { ascending: false });
      if (status && status !== "all") q = q.eq("status", status);
      const { data, error } = await q.limit(200);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data ?? []);
    }

    if (req.method === "POST") {
      const actor = actorFrom(req);
      const metric_record_id = Number(req.body?.metric_record_id);
      const reason = String(req.body?.reason ?? "").trim();
      if (!metric_record_id) return res.status(400).json({ error: "metric_record_id is required" });
      if (reason.length < 8) return res.status(400).json({ error: "Please describe the issue (8+ characters)." });

      const { data, error } = await supabaseAdmin
        .from("disputes")
        .insert({
          metric_record_id,
          raised_by: actor.name,
          reason,
          status: "open",
        })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
}
