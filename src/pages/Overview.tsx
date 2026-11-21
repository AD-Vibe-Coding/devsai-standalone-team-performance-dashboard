import { useState } from "react";
import { Link } from "react-router-dom";
import {
  KPI_BY_KEY,
  KPI_DEFS,
  formatKpi,
  slaLabel,
  slaMet,
} from "@/lib/kpis";
import { VOLUME_DEFS } from "@/lib/volumes";
import { type PeriodGrain } from "@/lib/seed-snapshot";
import { useSnapshotUploads } from "@/lib/snapshot-store";
import { hasLiveData, liveAt, liveKpiLeaderboard, periodLabelsLive } from "@/lib/live-data";
import { TEAM_MEMBERS } from "@/lib/team-members";
import { Delta } from "@/components/Delta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BlurFade } from "@/components/ui/blur-fade";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Overview() {
  const [grain, setGrain] = useState<PeriodGrain>("month");
  const labels = periodLabelsLive(grain);
  const [index, setIndex] = useState(labels.length - 1);
  const selectedIndex = Math.min(index, labels.length - 1);
  const { uploads } = useSnapshotUploads();
  const live = hasLiveData(uploads);
  const { overview: view, label, previous: prior, previousLabel } = liveAt(
    uploads,
    grain,
    selectedIndex,
  );
  function onGrainChange(next: PeriodGrain) {
    setGrain(next);
    setIndex(periodLabelsLive(next).length - 1);
  }

  if (!live) {
    return (
      <div className="space-y-8">
        <BlurFade>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">NOC</p>
            <h1 className="font-display mt-1 text-3xl md:text-4xl">Overall team performance</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Numbers come only from your Excel (column B = month, Oct 25–Oct 26). Upload the workbook to populate this page.
            </p>
          </div>
        </BlurFade>
        <Card>
          <CardContent className="flex flex-col items-start gap-4 py-10">
            <p className="text-sm text-muted-foreground">
              No file loaded yet. Snapshot / demo figures are not used.
            </p>
            <Button asChild>
              <Link to="/upload">Upload Excel</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BlurFade>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">NOC</p>
            <h1 className="font-display mt-1 text-3xl md:text-4xl">Overall team performance</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              From uploaded Excel for {label}. Deltas vs{" "}
              {previousLabel ?? "the first period (no prior)"}.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <div className="w-full sm:w-[160px]">
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                View
              </label>
              <Select value={grain} onValueChange={(v) => onGrainChange(v as PeriodGrain)}>
                <SelectTrigger aria-label="Month or quarter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="quarter">Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-[180px]">
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
                {grain === "month" ? "Month" : "Quarter"}
              </label>
              <Select value={String(selectedIndex)} onValueChange={(v) => setIndex(Number(v))}>
                <SelectTrigger aria-label="Selected period">
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
        </div>
      </BlurFade>

      <div>
        <h2 className="font-display text-2xl">Volumes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Totals from the file{previousLabel ? `. Arrow is vs ${previousLabel}.` : ". First period — no prior to compare."}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {VOLUME_DEFS.map((v) => (
          <Card key={v.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{v.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display flex items-baseline text-3xl tabular-nums">
                <NumberTicker value={view.volumes[v.key]} />
                {prior ? (
                  <Delta
                    current={view.volumes[v.key]}
                    previous={prior.volumes[v.key]}
                    higherIsBetter
                    unit="number"
                  />
                ) : null}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="font-display text-2xl">SLA</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Floor-wide rates against published targets. Each metric has its own leaderboard for {label}.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {KPI_DEFS.filter((k) => k.showOnTeam).map((k) => {
          const overallKey = k.overallKey ?? k.key;
          const overallDef = KPI_BY_KEY[overallKey];
          const cell = view.kpis[overallKey] ?? view.kpis[k.key];
          const v = cell?.value ?? 0;
          const priorV = prior ? (prior.kpis[overallKey] ?? prior.kpis[k.key])?.value ?? 0 : null;
          const met = slaMet(k.overallSla, v);
          const has = cell != null;
          const rank = liveKpiLeaderboard(
            uploads,
            grain,
            selectedIndex,
            TEAM_MEMBERS,
            overallKey,
            overallDef.higherIsBetter,
          );
          return (
            <Card key={k.key} className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!has ? (
                  <p className="text-sm text-muted-foreground">Not in this file</p>
                ) : overallDef.unit === "seconds" ? (
                  <p className="font-display flex items-baseline text-3xl tabular-nums">
                    {formatKpi(v, overallDef.unit)}
                    {priorV != null ? (
                      <Delta
                        current={v}
                        previous={priorV}
                        higherIsBetter={overallDef.higherIsBetter}
                        unit="seconds"
                      />
                    ) : null}
                  </p>
                ) : (
                  <p className="font-display flex items-baseline text-3xl tabular-nums">
                    <NumberTicker value={Number(v.toFixed(overallDef.unit === "percent" ? 1 : 0))} />
                    {overallDef.unit === "percent" ? "%" : ""}
                    {priorV != null ? (
                      <Delta
                        current={v}
                        previous={priorV}
                        higherIsBetter={overallDef.higherIsBetter}
                        unit={overallDef.unit}
                      />
                    ) : null}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Overall SLA · {slaLabel(k.overallSla)}
                </p>
                {has && met === true ? (
                  <Badge>On SLA</Badge>
                ) : has && met === false ? (
                  <Badge variant="destructive">Off SLA</Badge>
                ) : null}

                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Leaderboard · {overallDef.higherIsBetter ? "highest first" : "fastest first"}
                  </p>
                  {!has ? (
                    <p className="text-sm text-muted-foreground">No ranking until this metric is in the file.</p>
                  ) : rank.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No names matched Tickets Acked By for this metric in {label}.
                    </p>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="py-1.5 pr-2 font-medium">#</th>
                          <th className="py-1.5 pr-2 font-medium">Member</th>
                          <th className="py-1.5 text-right font-medium tabular-nums">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rank.map((row, i) => (
                          <tr key={row.name} className="border-t border-border/70">
                            <td className="py-1.5 pr-2 tabular-nums text-muted-foreground">{i + 1}</td>
                            <td className="py-1.5 pr-2 font-medium">{row.name}</td>
                            <td className="py-1.5 text-right tabular-nums">
                              {formatKpi(row.value, overallDef.unit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
