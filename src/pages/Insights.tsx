import { useState } from "react";
import { Link } from "react-router-dom";
import { type PeriodGrain } from "@/lib/seed-snapshot";
import { useSnapshotUploads } from "@/lib/snapshot-store";
import { hasLiveData, liveInsights, periodLabelsLive } from "@/lib/live-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/ui/blur-fade";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function deltaText(n: number) {
  if (!n) return "flat vs prior";
  return n > 0 ? `+${n.toLocaleString("en-US")} vs prior` : `${n.toLocaleString("en-US")} vs prior`;
}

export default function Insights() {
  const [grain, setGrain] = useState<PeriodGrain>("month");
  const labels = periodLabelsLive(grain);
  const [index, setIndex] = useState(labels.length - 1);
  const selectedIndex = Math.min(index, labels.length - 1);
  const { uploads } = useSnapshotUploads();
  const live = hasLiveData(uploads);
  const facts = liveInsights(uploads, grain, selectedIndex);
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
            "Why did ticket count change? Are maintenance tickets higher than last period? Did Comcast outage or maintenance tickets increase?",
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
              Upload tickets first. AI briefing uses month-over-month volume, maintenance vs outage mix, and Comcast.
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

  const { current, previous, deltas } = facts;

  return (
    <div className="space-y-8">
      <BlurFade>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">NOC</p>
            <h1 className="font-display mt-1 text-3xl md:text-4xl">Insights</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {current.label}
              {previous ? ` vs ${previous.label}` : " (first period — no prior)"}. Mix uses ticket type / subject / carrier text (maintenance, outage, Comcast).
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Select
              value={grain}
              onValueChange={(v) => {
                setGrain(v as PeriodGrain);
                setIndex(periodLabelsLive(v as PeriodGrain).length - 1);
              }}
            >
              <SelectTrigger className="w-[160px]" aria-label="View">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="quarter">Quarter</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(selectedIndex)} onValueChange={(v) => setIndex(Number(v))}>
              <SelectTrigger className="w-[180px]" aria-label="Period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {labels.map((l, i) => (
                  <SelectItem key={l} value={String(i)}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </BlurFade>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Tickets", value: current.tickets, d: deltas.tickets },
          { title: "Maintenance", value: current.mix.maintenance, d: deltas.maintenance },
          { title: "Outage", value: current.mix.outage, d: deltas.outage },
          { title: "Comcast", value: current.mix.comcast, d: deltas.comcast },
          { title: "Comcast maintenance", value: current.mix.comcastMaintenance, d: deltas.comcastMaintenance },
          { title: "Comcast outage", value: current.mix.comcastOutage, d: deltas.comcastOutage },
        ].map((c) => (
          <Card key={c.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl tabular-nums">{c.value.toLocaleString("en-US")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{deltaText(c.d)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top carriers this period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {current.topCarriers.length === 0 ? (
            <p className="text-muted-foreground">No carrier names in this file.</p>
          ) : (
            current.topCarriers.map((c) => (
              <div key={c.name} className="flex justify-between gap-4">
                <span>{c.name}</span>
                <span className="tabular-nums text-muted-foreground">{c.tickets.toLocaleString("en-US")}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">AI briefing</CardTitle>
          <Button onClick={runAi} disabled={busy}>
            {busy ? "Analyzing…" : briefing ? "Refresh analysis" : "Analyze with AI"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          {briefing ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{briefing}</div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Runs against uploaded facts only: volume change, maintenance vs outage, and Comcast.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
