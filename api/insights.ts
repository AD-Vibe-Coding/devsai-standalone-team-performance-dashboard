import type { VercelRequest, VercelResponse } from "@vercel/node";

const SYSTEM = `You are writing for NOC leadership. Produce an executive-level summary of the CURRENT month versus LAST month using only the JSON facts.
Rules:
- Use the numbers in the payload. Do not invent counts.
- Open with ticket volume this month vs last month (count and percent if possible).
- Cover maintenance vs outage mix and whether each rose or fell.
- Call out Comcast (and Xfinity), including Comcast maintenance and Comcast outage if present.
- Mention the top carriers that moved.
- If mix counts are all zero, say ticket type/carrier text was not recognized and do not pretend mix is known.
- If there is no previous period, say so and summarize the current month only.
- 3–6 short paragraphs. No markdown tables. Tone: calm, specific, board-ready.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "POST only" });
    }

    const apiKey = process.env.AI_API_KEY;
    const platformUrl = process.env.AI_PLATFORM_URL || "https://devs.ai";
    const model = process.env.AI_AGENT_ID || "gpt-4.1-mini";
    if (!apiKey) {
      return res.status(500).json({ error: "AI is not configured for this app." });
    }

    const body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) as {
      payload?: unknown;
      question?: string;
    };
    const question =
      (body.question || "").trim() ||
      "Explain why ticket volume changed vs the prior period. Call out maintenance vs outage mix and Comcast specifically.";
    const input = `${SYSTEM}\n\n${question}\n\nFacts JSON:\n${JSON.stringify(body.payload ?? {})}`;

    const upstream = await fetch(`${platformUrl}/api/v2/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return res.status(502).json({
        error: `AI request failed (${upstream.status})`,
        detail: detail.slice(0, 400),
      });
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let briefing = "";
    let currentEvent = "";
    let currentData = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          currentData = line.slice(6);
        } else if (line === "") {
          if (currentEvent === "response.output_text.delta" && currentData && currentData !== "[DONE]") {
            try {
              const parsed = JSON.parse(currentData) as { delta?: string };
              if (typeof parsed.delta === "string") briefing += parsed.delta;
            } catch {
              /* skip */
            }
          }
          currentEvent = "";
          currentData = "";
        }
      }
    }

    return res.status(200).json({
      briefing: briefing.trim() || "No briefing returned.",
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Server error",
    });
  }
}
