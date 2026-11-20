import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { KPI_DEFS, formatKpi } from "@/lib/kpis";
import { TEAMS } from "@/lib/roster";
import { FilterBar, defaultFilters, type Filters } from "@/components/FilterBar";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/States";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BlurFade } from "@/components/ui/blur-fade";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Overview = {
  kpis: Record<string, { value: number; n: number }>;
  teams: { slug: string; metrics: Record<string, number>; n: number }[];
  rowCount: number;
};

export default function Overview() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      team: filters.team,
      from: filters.from,
      to: filters.to,
    });
    api
      .get<Overview>(`/api/overview?${qs}`)
      .then((d) => {
        if (!cancelled) setData(d);
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
  }, [filters]);

  return (
    <div className="space-y-8">
      <BlurFade>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Shift floor</p>
          <h1 className="font-display mt-1 text-3xl md:text-4xl">How the floor is running</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Six ops KPIs, rolled up from imported daily rows. Import a file if this period is empty.
          </p>
        </div>
      </BlurFade>
      <FilterBar value={filters} onChange={setFilters} />
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingBlock /> : null}
      {!loading && data && data.rowCount === 0 ? (
        <EmptyState
          title="No metrics in this window"
          body="Import a CSV or Excel export with date, team, agent, metric_key, and value."
          action={
            <Button asChild>
              <Link to="/import">Open import</Link>
            </Button>
          }
        />
      ) : null}
      {!loading && data && data.rowCount > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {KPI_DEFS.map((k) => {
              const cell = data.kpis[k.key];
              const v = cell?.value ?? 0;
              return (
                <Card key={k.key} className="relative overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {k.unit === "seconds" ? (
                      <p className="font-display text-3xl tabular-nums">{formatKpi(v, k.unit)}</p>
                    ) : (
                      <p className="font-display text-3xl tabular-nums">
                        <NumberTicker value={Number(v.toFixed(k.unit === "percent" ? 1 : 0))} />
                        {k.unit === "percent" ? "%" : ""}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {cell?.n ?? 0} rows · {k.higherIsBetter ? "higher is better" : "lower is better"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Team rollup</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    {KPI_DEFS.map((k) => (
                      <TableHead key={k.key} className="text-right">
                        {k.short}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.teams.map((t) => (
                    <TableRow key={t.slug}>
                      <TableCell className="font-medium">
                        {TEAMS.find((x) => x.slug === t.slug)?.name ?? t.slug}
                      </TableCell>
                      {KPI_DEFS.map((k) => (
                        <TableCell key={k.key} className="text-right tabular-nums">
                          {formatKpi(t.metrics[k.key] ?? 0, k.unit)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
