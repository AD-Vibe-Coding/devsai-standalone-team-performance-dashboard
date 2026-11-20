import { useState } from "react";
import {
  KPI_BY_KEY,
  KPI_DEFS,
  TEAM_KPI_DEFS,
  formatKpi,
  slaLabel,
  slaMet,
} from "@/lib/kpis";
import { VOLUME_DEFS } from "@/lib/volumes";
import { tierName } from "@/lib/roster";
import {
  snapshotCompare,
  snapshotLeaderboards,
  snapshotOverview,
  type ComparePeriod,
  type LeaderboardRow,
} from "@/lib/seed-snapshot";
import { Delta } from "@/components/Delta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BlurFade } from "@/components/ui/blur-fade";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function rankRows(rows: LeaderboardRow[], higherIsBetter: boolean) {
  return [...rows].sort((a, b) => (higherIsBetter ? b.value - a.value : a.value - b.value));
}

export default function Overview() {
  const [period, setPeriod] = useState<ComparePeriod>("month");
  const data = snapshotOverview();
  const prior = snapshotCompare(period);
  const boards = snapshotLeaderboards();

  return (
    <div className="space-y-8">
      <BlurFade>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">NOC</p>
            <h1 className="font-display mt-1 text-3xl md:text-4xl">Overall team performance</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Floor-wide volumes and SLA for NOC, then a leaderboard for each metric — best to last.
              Snapshot numbers for Tier 1–3.
            </p>
          </div>
          <div className="w-full sm:w-[240px]">
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
              Compare to
            </label>
            <Select value={period} onValueChange={(v) => setPeriod(v as ComparePeriod)}>
              <SelectTrigger aria-label="Compare to previous period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Previous month</SelectItem>
                <SelectItem value="quarter">Previous quarter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </BlurFade>

      <div>
        <h2 className="font-display text-2xl">Volumes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Totals across NOC. Arrow is vs {period === "month" ? "last month" : "last quarter"}.
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
                <NumberTicker value={data.volumes[v.key]} />
                <Delta
                  current={data.volumes[v.key]}
                  previous={prior.volumes[v.key]}
                  higherIsBetter
                  unit="number"
                />
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="font-display text-2xl">SLA</h2>
        <p className="mt-1 text-sm text-muted-foreground">Floor-wide rates against published targets.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_DEFS.filter((k) => k.showOnTeam).map((k) => {
          const overallKey = k.overallKey ?? k.key;
          const overallDef = KPI_BY_KEY[overallKey];
          const cell = data.kpis[overallKey] ?? data.kpis[k.key];
          const v = cell?.value ?? 0;
          const priorV = (prior.kpis[overallKey] ?? prior.kpis[k.key])?.value ?? 0;
          const met = slaMet(k.overallSla, v);
          return (
            <Card key={k.key} className="relative overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {overallDef.unit === "seconds" ? (
                  <p className="font-display flex items-baseline text-3xl tabular-nums">
                    {formatKpi(v, overallDef.unit)}
                    <Delta
                      current={v}
                      previous={priorV}
                      higherIsBetter={overallDef.higherIsBetter}
                      unit="seconds"
                    />
                  </p>
                ) : (
                  <p className="font-display flex items-baseline text-3xl tabular-nums">
                    <NumberTicker value={Number(v.toFixed(overallDef.unit === "percent" ? 1 : 0))} />
                    {overallDef.unit === "percent" ? "%" : ""}
                    <Delta
                      current={v}
                      previous={priorV}
                      higherIsBetter={overallDef.higherIsBetter}
                      unit={overallDef.unit}
                    />
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Overall SLA · {slaLabel(k.overallSla)}
                </p>
                {met === true ? (
                  <Badge className="mt-2">On SLA</Badge>
                ) : met === false ? (
                  <Badge variant="destructive" className="mt-2">
                    Off SLA
                  </Badge>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Tier rollup</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                {VOLUME_DEFS.map((v) => (
                  <TableHead key={v.key} className="text-right">
                    {v.short}
                  </TableHead>
                ))}
                {TEAM_KPI_DEFS.map((k) => (
                  <TableHead key={k.key} className="text-right">
                    {k.short}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.teams.map((t) => (
                <TableRow key={t.slug}>
                  <TableCell className="font-medium">{tierName(t.slug)}</TableCell>
                  {VOLUME_DEFS.map((v) => (
                    <TableCell key={v.key} className="text-right tabular-nums">
                      {t.volumes[v.key].toLocaleString("en-US")}
                    </TableCell>
                  ))}
                  {TEAM_KPI_DEFS.map((k) => {
                    const overallKey = k.overallKey ?? k.key;
                    const overallDef = KPI_BY_KEY[overallKey];
                    const val = t.metrics[overallKey] ?? t.metrics[k.key] ?? 0;
                    return (
                      <TableCell key={k.key} className="text-right tabular-nums">
                        {formatKpi(val, overallDef.unit)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div>
        <h2 className="font-display text-2xl">Leaderboards</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ranked best to last for each metric. Refused calls is people-only (lower is better).
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {KPI_DEFS.map((k) => {
          const ranked = rankRows(boards[k.key] ?? [], k.higherIsBetter);
          return (
            <Card key={k.key}>
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg">{k.label}</CardTitle>
                <p className="text-xs text-muted-foreground">Member SLA · {k.memberSla.label}</p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">SLA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranked.map((row, i) => {
                      const met = slaMet(k.memberSla, row.value);
                      return (
                        <TableRow key={row.agent}>
                          <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{row.agent}</TableCell>
                          <TableCell className="text-muted-foreground">{tierName(row.team)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatKpi(row.value, k.unit)}
                          </TableCell>
                          <TableCell className="text-right">
                            {met === true ? (
                              <Badge>On</Badge>
                            ) : met === false ? (
                              <Badge variant="destructive">Off</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
