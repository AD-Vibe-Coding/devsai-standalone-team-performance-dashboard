import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KPI_BY_KEY, KPI_DEFS, formatKpi } from "@/lib/kpis";
import { VOLUME_DEFS } from "@/lib/volumes";
import { snapshotTrends, type TrendGrain } from "@/lib/seed-snapshot";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Delta } from "@/components/Delta";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STROKE = "#0b5cab";

function TrendArea({
  data,
  grain,
  formatValue,
  fillId,
}: {
  data: { label: string; value: number }[];
  grain: TrendGrain;
  formatValue: (v: number) => string;
  fillId: string;
}) {
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.22, max * 0.04, 0.5);
  const domain: [number, number] = [Math.max(0, min - pad), max + pad];
  const angled = grain === "month";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 22, right: 20, left: 0, bottom: angled ? 28 : 8 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={STROKE} stopOpacity={0.38} />
            <stop offset="100%" stopColor={STROKE} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#d5dde5" vertical={false} />
        <XAxis
          dataKey="label"
          interval={0}
          tick={{ fontSize: 10, fill: "#5b6775" }}
          tickMargin={8}
          angle={angled ? -40 : 0}
          textAnchor={angled ? "end" : "middle"}
          height={angled ? 52 : 28}
        />
        <YAxis
          domain={domain}
          width={48}
          tick={{ fontSize: 11, fill: "#5b6775" }}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v * 10) / 10)
          }
        />
        <Tooltip
          formatter={(val: number) => formatValue(val)}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #d5dde5",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={STROKE}
          strokeWidth={2.5}
          fill={`url(#${fillId})`}
          dot={{ r: 3, fill: STROKE, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MetricTrend({
  title,
  data,
  grain,
  formatValue,
  higherIsBetter,
  unit,
  fillId,
}: {
  title: string;
  data: { label: string; value: number }[];
  grain: TrendGrain;
  formatValue: (v: number) => string;
  higherIsBetter: boolean;
  unit: "percent" | "number" | "seconds";
  fillId: string;
}) {
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const display = last?.value ?? 0;
  const isSeconds = unit === "seconds";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="font-display mt-1 flex items-baseline text-3xl tabular-nums">
              {isSeconds ? (
                formatValue(display)
              ) : (
                <>
                  <NumberTicker value={Number(display.toFixed(unit === "percent" ? 1 : 0))} />
                  {unit === "percent" ? "%" : ""}
                </>
              )}
              {prev ? (
                <Delta
                  current={display}
                  previous={prev.value}
                  higherIsBetter={higherIsBetter}
                  unit={unit}
                />
              ) : null}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {last?.label}
              {prev ? ` vs ${prev.label}` : ""}
            </p>
          </div>
        </div>
        <div className="mt-2 h-64">
          <TrendArea data={data} grain={grain} formatValue={formatValue} fillId={fillId} />
        </div>
      </CardContent>
    </Card>
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
              Last {windowLabel}. Filled area shows the path of each metric; Y-axis zooms to the range so dips and rises read clearly.
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
        <p className="mt-1 text-sm text-muted-foreground">Totals across NOC. Hover a point for the exact period.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {VOLUME_DEFS.map((v) => {
          const data = series.map((p) => ({ label: p.label, value: p.volumes[v.key] }));
          return (
            <MetricTrend
              key={v.key}
              title={v.label}
              data={data}
              grain={grain}
              formatValue={(val) => val.toLocaleString("en-US")}
              higherIsBetter
              unit="number"
              fillId={`vol-${v.key}`}
            />
          );
        })}
      </div>

      <div>
        <h2 className="font-display text-2xl">SLA</h2>
        <p className="mt-1 text-sm text-muted-foreground">Floor-wide rates over the same window.</p>
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
            <MetricTrend
              key={k.key}
              title={k.label}
              data={data}
              grain={grain}
              formatValue={(val) => formatKpi(val, overallDef.unit)}
              higherIsBetter={overallDef.higherIsBetter}
              unit={overallDef.unit}
              fillId={`kpi-${k.key}`}
            />
          );
        })}
      </div>
    </div>
  );
}
