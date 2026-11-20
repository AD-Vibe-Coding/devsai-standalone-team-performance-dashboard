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

const STROKE = "#0b5cab";

function TrendChart({
  data,
  grain,
  formatValue,
}: {
  data: { label: string; value: number }[];
  grain: TrendGrain;
  formatValue: (v: number) => string;
}) {
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.12, max * 0.04);
  const domain: [number, number] = [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 12, right: 28, left: 4, bottom: 28 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#d5dde5" />
        <XAxis
          dataKey="label"
          interval={0}
          tick={{ fontSize: 10, fill: "#5b6775" }}
          tickMargin={8}
          angle={grain === "month" ? -40 : 0}
          textAnchor={grain === "month" ? "end" : "middle"}
          height={grain === "month" ? 52 : 28}
          minTickGap={0}
        />
        <YAxis
          domain={domain}
          tick={{ fontSize: 11, fill: "#5b6775" }}
          width={44}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v)
          }
        />
        <Tooltip
          formatter={(val: number) => formatValue(val)}
          labelClassName="text-foreground"
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={STROKE}
          strokeWidth={2}
          dot={{ r: 3, fill: STROKE, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

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
              Snapshot series for volumes and SLA — last {windowLabel}. Every period is on the axis.
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
              <CardContent className="h-72">
                <TrendChart
                  data={data}
                  grain={grain}
                  formatValue={(val) => val.toLocaleString("en-US")}
                />
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
              <CardContent className="h-72">
                <TrendChart
                  data={data}
                  grain={grain}
                  formatValue={(val) => formatKpi(val, overallDef.unit)}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Volume data</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                {VOLUME_DEFS.map((v) => (
                  <TableHead key={v.key} className="text-right">
                    {v.short}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.map((p) => (
                <TableRow key={p.label}>
                  <TableCell className="font-medium">{p.label}</TableCell>
                  {VOLUME_DEFS.map((v) => (
                    <TableCell key={v.key} className="text-right tabular-nums">
                      {p.volumes[v.key].toLocaleString("en-US")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">SLA data</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                {KPI_DEFS.filter((k) => k.showOnTeam).map((k) => (
                  <TableHead key={k.key} className="text-right">
                    {k.short}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.map((p) => (
                <TableRow key={p.label}>
                  <TableCell className="font-medium">{p.label}</TableCell>
                  {KPI_DEFS.filter((k) => k.showOnTeam).map((k) => {
                    const overallKey = k.overallKey ?? k.key;
                    const overallDef = KPI_BY_KEY[overallKey];
                    const val = p.kpis[overallKey] ?? p.kpis[k.key] ?? 0;
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
    </div>
  );
}
