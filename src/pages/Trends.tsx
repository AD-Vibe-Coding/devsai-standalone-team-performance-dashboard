import { useEffect, useMemo, useState } from "react";
import { loadTrends } from "@/lib/data";
import { KPI_DEFS, type KpiKey, formatKpi } from "@/lib/kpis";
import { FilterBar, defaultFilters, type Filters } from "@/components/FilterBar";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/States";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Point = { date: string } & Record<string, number | string>;

export default function Trends() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [metric, setMetric] = useState<KpiKey>("csat");
  const [series, setSeries] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const def = KPI_DEFS.find((k) => k.key === metric)!;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadTrends(filters.team, filters.from, filters.to, metric)
      .then((d) => {
        if (!cancelled) setSeries(d.series);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, metric]);

  const max = useMemo(() => {
    const vals = series.map((p) => Number(p[metric] ?? 0));
    return Math.max(1, ...vals);
  }, [series, metric]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Time series</p>
        <h1 className="font-display mt-1 text-3xl">Daily trend</h1>
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <FilterBar value={filters} onChange={setFilters} />
        </div>
        <div className="space-y-1.5">
          <Label>Metric</Label>
          <Select value={metric} onValueChange={(v) => setMetric(v as KpiKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KPI_DEFS.map((k) => (
                <SelectItem key={k.key} value={k.key}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingBlock /> : null}
      {!loading && series.length === 0 ? (
        <EmptyState title="No trend points" body="Widen the date range or import daily rows first." />
      ) : null}
      {!loading && series.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display">
              {def.label} · {filters.from} → {filters.to}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-56 items-end gap-1" role="img" aria-label={`${def.label} by day`}>
              {series.map((p) => {
                const v = Number(p[metric] ?? 0);
                const h = Math.max(4, (v / max) * 100);
                return (
                  <div key={String(p.date)} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm bg-primary/80 transition-all duration-200 hover:bg-primary"
                      style={{ height: `${h}%` }}
                      title={`${p.date}: ${formatKpi(v, def.unit)}`}
                    />
                    <span className="truncate text-[9px] text-muted-foreground">{String(p.date).slice(5)}</span>
                  </div>
                );
              })}
            </div>
            <ul className="mt-6 space-y-1 text-sm tabular-nums">
              {series.slice(-7).map((p) => (
                <li key={String(p.date)} className="flex justify-between border-b border-border py-1">
                  <span>{String(p.date)}</span>
                  <span>{formatKpi(Number(p[metric] ?? 0), def.unit)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
