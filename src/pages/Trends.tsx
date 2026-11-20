import { useState } from "react";
import { KPI_BY_KEY, KPI_DEFS, formatKpi } from "@/lib/kpis";
import { VOLUME_DEFS } from "@/lib/volumes";
import { snapshotTrends, type TrendGrain } from "@/lib/seed-snapshot";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";
import { PeriodHeatmap, TrendSpark } from "@/components/TrendSpark";
import { Delta } from "@/components/Delta";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function latestDelta(values: number[]) {
  if (values.length < 2) return null;
  return { current: values[values.length - 1], previous: values[values.length - 2] };
}

function MetricCard({
  title,
  data,
  formatValue,
  higherIsBetter,
  unit,
  sparkId,
}: {
  title: string;
  data: { label: string; value: number }[];
  formatValue: (v: number) => string;
  higherIsBetter: boolean;
  unit: "percent" | "number" | "seconds";
  sparkId: string;
}) {
  const last = data[data.length - 1];
  const delta = latestDelta(data.map((d) => d.value));
  const display = last?.value ?? 0;
  const isSeconds = unit === "seconds";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="font-display mt-1 flex items-baseline text-3xl tabular-nums">
              {isSeconds ? (
                formatValue(display)
              ) : (
                <>
                  <NumberTicker
                    value={Number(display.toFixed(unit === "percent" ? 1 : 0))}
                  />
                  {unit === "percent" ? "%" : ""}
                </>
              )}
              {delta ? (
                <Delta
                  current={delta.current}
                  previous={delta.previous}
                  higherIsBetter={higherIsBetter}
                  unit={unit}
                />
              ) : null}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Latest · {last?.label}
              {data[data.length - 2] ? ` vs ${data[data.length - 2].label}` : ""}
            </p>
          </div>
        </div>
        <TrendSpark data={data} id={sparkId} className="mt-3 h-20" />
        <div className="mt-4">
          <PeriodHeatmap data={data} formatValue={formatValue} higherIsBetter={higherIsBetter} />
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
              Last {windowLabel}. Latest value up top, sparkline for shape, heatmap for every period.
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
        <p className="mt-1 text-sm text-muted-foreground">Totals across NOC. Heat cells show every period.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {VOLUME_DEFS.map((v) => {
          const data = series.map((p) => ({ label: p.label, value: p.volumes[v.key] }));
          return (
            <MetricCard
              key={v.key}
              title={v.label}
              data={data}
              formatValue={(val) => val.toLocaleString("en-US")}
              higherIsBetter
              unit="number"
              sparkId={`vol-${v.key}`}
            />
          );
        })}
      </div>

      <div>
        <h2 className="font-display text-2xl">SLA</h2>
        <p className="mt-1 text-sm text-muted-foreground">Floor-wide rates. Darker cells are stronger for that metric.</p>
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
            <MetricCard
              key={k.key}
              title={k.label}
              data={data}
              formatValue={(val) => formatKpi(val, overallDef.unit)}
              higherIsBetter={overallDef.higherIsBetter}
              unit={overallDef.unit}
              sparkId={`kpi-${k.key}`}
            />
          );
        })}
      </div>
    </div>
  );
}
