import { KPI_DEFS } from "@/lib/kpis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Help() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Definitions</p>
        <h1 className="font-display mt-1 text-3xl">KPI guide</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          How each number is computed. Change roster mapping in src/lib/roster.ts without touching
          these formulas.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {KPI_DEFS.map((k) => (
          <Card key={k.key}>
            <CardHeader>
              <CardTitle className="font-display text-xl">{k.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{k.description}</p>
              <p className="text-muted-foreground">
                Formula: <span className="text-foreground">{k.formula}</span>
              </p>
              <p>
                Member SLA: <span className="font-medium">{k.memberSla.label}</span>
              </p>
              <p>
                Overall SLA:{" "}
                <span className="font-medium">
                  {k.overallSla ? k.overallSla.label : "not scored for the team"}
                </span>
              </p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Import key · {k.key}
                {k.overallKey ? ` · overall uses ${k.overallKey}` : ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
