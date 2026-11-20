import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin.js";
import { requireManager } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const id = Number(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    if (req.method !== "PATCH") {
      res.setHeader("Allow", "PATCH");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const actor = requireManager(req, res);
    if (!actor) return;

    const status = String(req.body?.status ?? "");
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "status must be approved or rejected" });
    }
    const review_note = String(req.body?.review_note ?? "").trim();

    const { data, error } = await supabaseAdmin
      .from("disputes")
      .update({ status, reviewer: actor.name, review_note: review_note || null })
      .eq("id", id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
}
