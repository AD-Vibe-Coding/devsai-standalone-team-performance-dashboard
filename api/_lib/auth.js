/**
 * Simple role gate for this standalone app.
 * The UI sends X-App-Role and X-App-Actor (display name).
 * Update ROSTER in src/lib/roster.ts — this file only checks the header.
 */

export function actorFrom(req) {
  const role = String(req.headers["x-app-role"] || "staff").toLowerCase();
  const name = String(req.headers["x-app-actor"] || "Guest");
  const normalized = role === "manager" ? "manager" : "staff";
  return { role: normalized, name };
}

export function requireManager(req, res) {
  const actor = actorFrom(req);
  if (actor.role !== "manager") {
    res.status(403).json({ error: "Managers only. Switch role in the header to review or import." });
    return null;
  }
  return actor;
}
