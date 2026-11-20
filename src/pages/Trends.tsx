import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KPI_BY_KEY, KPI_DEFS, formatKpi } from "@/lib/kpis";
import { VOLUME_DEFS } from "@/lib/volumes";
import { snapshotTrends, type TrendGrain } from "@/lib/seed-snapshot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STROKE = "hsl(var(--primary))";

export default function Trends() {
  const [grain, setGrain] = useState<TrendGrain>("month");
  const series = snapshotTrends(grain);
  const windowLabel = grain === "month" ? "13 months" : "5 quarters";

  return (
    <div className="space-y-8">
      <BlurFade>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">NOC</p>
            <h1 className="font-display mt-1 text-3xl md:text-4xl">Trends</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Snapshot series for volumes and SLA — last {windowLabel}.
            </p>
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Window
            <Select value={grain} onValueChange={(v) => setGrain(v as TrendGrain)}>
              <SelectTrigger className="w-[200px]" aria-label="Trend window">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">13 months</SelectItem>
                <SelectItem value="quarter">5 quarters</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
      </BlurFade>

      <div>
        <h2 className="font-display text-2xl">Volumes</h2>
        <p className="mt-1 text-sm text-muted-foreground">Totals across NOC for each period.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {VOLUME_DEFS.map((v) => {
          const data = series.map((p) => ({ label: p.label, value: p.volumes[v.key] }));
          return (
            <Card key={v.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{v.label}</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={grain === "month" ? 1 : 0} />
                    <YAxis tick={{ fontSize: 11 }} width={40} />
                    <Tooltip
                      formatter={(val: number) => val.toLocaleString("en-US")}
                      labelClassName="text-foreground"
                    />
                    <Line type="monotone" dataKey="value" stroke={STROKE} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div>
        <h2 className="font-display text-2xl">SLA</h2>
        <p className="mt-1 text-sm text-muted-foreground">Floor-wide rates for each period.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {KPI_DEFS.filter((k) => k.showOnTeam).map((k) => {
          const overallKey = k.overallKey ?? k.key;
          const overallDef = KPI_BY_KEY[overallKey];
          const data = series.map((p) => ({
            label: p.label,
            value: p.kpis[overallKey] ?? p.kpis[k.key] ?? 0,
          }));
          return (
            <Card key={k.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={grain === "month" ? 1 : 0} />
                    <YAxis tick={{ fontSize: 11 }} width={40} />
                    <Tooltip
                      formatter={(val: number) => formatKpi(val, overallDef.unit)}
                    />
                    <Line type="monotone" dataKey="value" stroke={STROKE} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
