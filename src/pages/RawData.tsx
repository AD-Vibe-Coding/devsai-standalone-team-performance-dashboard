import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { KPI_DEFS, formatKpi, KPI_BY_KEY, type KpiKey } from "@/lib/kpis";
import { FilterBar, defaultFilters, type Filters } from "@/components/FilterBar";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/States";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TEAMS } from "@/lib/roster";

type Row = {
  id: number;
  period_date: string;
  team_slug: string;
  agent_name: string;
  metric_key: KpiKey;
  metric_value: number;
};

export default function RawData() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [metric, setMetric] = useState<string>("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({
      team: filters.team,
      from: filters.from,
      to: filters.to,
      q,
    });
    if (metric !== "all") qs.set("metric", metric);
    api
      .get<Row[]>(`/api/metrics?${qs}`)
      .then((d) => {
        if (!cancelled) setRows(d);
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
  }, [filters, metric, q]);

  async function submitDispute() {
    if (!open) return;
    setSaving(true);
    try {
      await api.post("/api/disputes", { metric_record_id: open.id, reason });
      setOpen(null);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open dispute");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Drill-down</p>
        <h1 className="font-display mt-1 text-3xl">Raw metric rows</h1>
      </div>
      <FilterBar value={filters} onChange={setFilters} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Metric</Label>
          <Select value={metric} onValueChange={setMetric}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All metrics</SelectItem>
              {KPI_DEFS.map((k) => (
                <SelectItem key={k.key} value={k.key}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q">Search agent or team</Label>
          <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Priya" />
        </div>
      </div>
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingBlock /> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState title="No matching rows" body="Adjust filters or import data." />
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const def = KPI_BY_KEY[r.metric_key];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums">{r.period_date}</TableCell>
                    <TableCell>{TEAMS.find((t) => t.slug === r.team_slug)?.name ?? r.team_slug}</TableCell>
                    <TableCell>{r.agent_name}</TableCell>
                    <TableCell>{def?.short ?? r.metric_key}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatKpi(r.metric_value, def?.unit ?? "number")}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setOpen(r)}>
                        Flag
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Flag this metric</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {open?.agent_name} · {open?.metric_key} on {open?.period_date}
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What looks wrong, and what should we check?"
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button onClick={submitDispute} disabled={saving || reason.trim().length < 8}>
              {saving ? "Sending…" : "Open dispute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
