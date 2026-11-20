import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { parseImportText, sampleCsv } from "@/lib/parse-import";
import { downloadBlob } from "@/lib/download";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ROSTER } from "@/lib/roster";

type Batch = {
  id: number;
  filename: string;
  status: string;
  row_count: number;
  error_summary: string | null;
  imported_by: string;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
};

export default function ImportPage() {
  const actor = localStorage.getItem("tp_actor") || ROSTER[0].name;
  const role = ROSTER.find((p) => p.name === actor)?.role ?? "staff";
  const [history, setHistory] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    loadImports()
      .then((rows) => setHistory(rows as Batch[]))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  async function onFile(file: File) {
    setNote(null);
    setPreviewErrors([]);
    const text = await file.text();
    const parsed = parseImportText(text);
    if (!parsed.rows.length) {
      setPreviewErrors(parsed.errors.length ? parsed.errors : ["No valid rows"]);
      return;
    }
    if (role !== "manager") {
      setError("Only managers can import. Switch the acting user in the header.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.post<{ accepted: number; errors: string[] }>("/api/imports", {
        filename: file.name,
        rows: parsed.rows,
      });
      setNote(`Imported ${result.accepted} rows.`);
      setPreviewErrors(result.errors ?? []);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Ingest</p>
        <h1 className="font-display mt-1 text-3xl">Import metrics</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          CSV or Excel-exported CSV. Columns: date, team, agent, metric_key, value. Managers only.
        </p>
      </div>
      {error ? <ErrorState message={error} /> : null}
      {note ? <p className="text-sm text-foreground">{note}</p> : null}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Upload</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={busy || role !== "manager"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
            <Button type="button" asChild disabled={busy || role !== "manager"}>
              <span>{busy ? "Importing…" : "Choose CSV"}</span>
            </Button>
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => downloadBlob(new Blob([sampleCsv()], { type: "text/csv" }), "sample-metrics.csv")}
          >
            Download sample CSV
          </Button>
        </CardContent>
      </Card>
      {previewErrors.length > 0 ? (
        <ul className="list-disc pl-5 text-sm text-destructive">
          {previewErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {loading ? <LoadingBlock /> : null}
      {!loading && history.length === 0 ? (
        <EmptyState title="No imports yet" body="Load the sample file to populate overview and trends." />
      ) : null}
      {history.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Import history</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="tabular-nums text-xs">
                      {b.created_at ? new Date(b.created_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>{b.filename}</TableCell>
                    <TableCell>
                      <Badge variant={b.status === "imported" ? "default" : "secondary"}>{b.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.row_count}</TableCell>
                    <TableCell>{b.imported_by}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
