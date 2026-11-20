import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROSTER } from "@/lib/roster";

type Dispute = {
  id: number;
  metric_record_id: number;
  raised_by: string;
  reason: string;
  status: string;
  reviewer: string | null;
  review_note: string | null;
  created_at: string;
};

export default function Disputes() {
  const actor = localStorage.getItem("tp_actor") || ROSTER[0].name;
  const role = ROSTER.find((p) => p.name === actor)?.role ?? "staff";
  const [rows, setRows] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const load = () => {
    setLoading(true);
    api
      .get<Dispute[]>("/api/disputes")
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  async function review(id: number, status: "approved" | "rejected") {
    try {
      await reviewDispute(id, status, notes[id] ?? "");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Workflow</p>
        <h1 className="font-display mt-1 text-3xl">Disputes</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Staff flag a row; managers approve or reject. You are acting as {role}.
        </p>
      </div>
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingBlock /> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState title="No disputes" body="Flag a row from Raw data when a number looks off." />
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opened</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs tabular-nums">
                    {d.created_at ? new Date(d.created_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>{d.raised_by}</TableCell>
                  <TableCell className="max-w-xs text-sm">{d.reason}</TableCell>
                  <TableCell>
                    <Badge variant={d.status === "open" ? "secondary" : "default"}>{d.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {d.status === "open" && role === "manager" ? (
                      <div className="space-y-2">
                        <Textarea
                          rows={2}
                          value={notes[d.id] ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))}
                          placeholder="Review note"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => review(d.id, "approved")}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => review(d.id, "rejected")}>
                            Reject
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {d.reviewer ? `${d.reviewer}: ${d.review_note || "—"}` : "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
