import { TIERS } from "@/lib/roster";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Filters = { team: string; from: string; to: string };

export function defaultFilters(): Filters {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 13);
  return {
    team: "all",
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function FilterBar({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="team">Team</Label>
        <Select value={value.team} onValueChange={(team) => onChange({ ...value, team })}>
          <SelectTrigger id="team">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEAMS.map((t) => (
              <SelectItem key={t.slug} value={t.slug}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="from">From</Label>
        <Input
          id="from"
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="to">To</Label>
        <Input
          id="to"
          type="date"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </div>
    </div>
  );
}
