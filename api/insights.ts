const ENDPOINT = "https://api.devs.ai/v1/chat";

type Body = {
  payload?: unknown;
  question?: string;
};

export default async function handler(req: { method?: string; body?: Body }, res: {
  status: (n: number) => { json: (b: unknown) => void };
  json: (b: unknown) => void;
}) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const key = process.env.AI_AGENT_API_KEY;
  const model = process.env.AI_MODEL_ID || "gpt-4.1-mini";
  if (!key) {
    res.status(500).json({ error: "AI is not configured for this app." });
    return;
  }

  const payload = req.body?.payload ?? {};
  const question =
    req.body?.question?.trim() ||
    "Explain why ticket volume changed vs the prior period. Call out maintenance vs outage mix and Comcast specifically.";

  const system = `You are a NOC operations analyst. Write a concise briefing from the JSON facts only.
Rules:
- Use the numbers in the payload. Do not invent counts.
- Answer: did tickets go up or down vs last period, and by how many / percent if possible.
- Say whether maintenance tickets rose vs last month/quarter.
- Say whether outage tickets rose.
- Call out Comcast (and Xfinity) volume, including Comcast maintenance and Comcast outage if present.
- Mention the top carriers that moved.
- If mix counts are all zero, say ticket type/carrier text was not recognized in the upload and do not pretend mix is known.
- 3–6 short paragraphs or bullets. No markdown tables.`;

  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `${question}\n\nFacts JSON:\n${JSON.stringify(payload)}`,
        },
      ],
    }),
  });

  const text = await r.text();
  if (!r.ok) {
    res.status(502).json({ error: `AI request failed (${r.status})`, detail: text.slice(0, 400) });
    return;
  }

  let parsed: { choices?: { message?: { content?: string } }[] };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    res.status(502).json({ error: "AI returned non-JSON" });
    return;
  }
  const briefing = parsed.choices?.[0]?.message?.content?.trim() || "No briefing returned.";
  res.json({ briefing });
}
