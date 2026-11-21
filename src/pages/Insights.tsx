import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useSnapshotUploads } from "@/lib/snapshot-store";
import { hasLiveData, liveInsights, periodLabelsLive } from "@/lib/live-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/ui/blur-fade";

export default function Insights() {
  const { uploads } = useSnapshotUploads();
  const live = hasLiveData(uploads);
  const labels = periodLabelsLive("month");
  const facts = liveInsights(uploads, "month", Math.max(0, labels.length - 1));
  const [briefing, setBriefing] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function runAi() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: facts,
          question:
            "Write an executive-level summary of the current month versus last month. Lead with volume, then mix (maintenance, outage), Comcast, and notable carriers. Be concise and suitable for leadership.",
        }),
      });
      const data = (await res.json()) as { briefing?: string; error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setBriefing(data.briefing || "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setBusy(false);
    }
  }

  if (!live) {
    return (
      <div className="space-y-8">
        <BlurFade>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">NOC</p>
            <h1 className="font-display mt-1 text-3xl md:text-4xl">Insights</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Upload tickets first, then generate an executive month-over-month summary.
            </p>
          </div>
        </BlurFade>
        <Card>
          <CardContent className="flex flex-col items-start gap-4 py-10">
            <p className="text-sm text-muted-foreground">No file loaded.</p>
            <Button asChild>
              <Link to="/upload">Upload Excel</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <BlurFade>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">NOC</p>
          <h1 className="font-display mt-1 text-3xl md:text-4xl">Insights</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Executive summary for {facts.current.label}
            {facts.previous ? ` vs ${facts.previous.label}` : " (no prior month in this file)"}.
          </p>
        </div>
      </BlurFade>

      <Button size="lg" onClick={runAi} disabled={busy} className="gap-2">
        <Sparkles className="size-4" />
        {busy ? "Analyzing…" : briefing ? "Refresh analysis" : "Analyze with AI"}
      </Button>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      {briefing ? (
        <Card>
          <CardContent className="py-6">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{briefing}</div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
