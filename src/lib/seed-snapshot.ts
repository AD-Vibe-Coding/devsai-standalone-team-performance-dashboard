import { ROSTER, TIERS } from "./roster";
import type { KpiKey } from "./kpis";

const STAFF = ROSTER.filter((p) => p.role === "staff");

/** Stable snapshot so the home dashboard is filled on first open. */
const SNAPSHOT: Record<string, Partial<Record<KpiKey, number>>> = {
  "Priya Shah": {
    avg_ack_seconds: 95,
    ack_under_5_pct: 94.2,
    carrier_open_sla_pct: 96.1,
    refused_calls: 0,
    asa_seconds: 5.2,
    mobility_sla_pct: 97.4,
  },
  "Marcus Chen": {
    avg_ack_seconds: 142,
    ack_under_5_pct: 88.5,
    carrier_open_sla_pct: 91.3,
    refused_calls: 1,
    asa_seconds: 6.8,
    mobility_sla_pct: 92.1,
  },
  "Sam Okonkwo": {
    avg_ack_seconds: 168,
    ack_under_5_pct: 86.0,
    carrier_open_sla_pct: 89.4,
    refused_calls: 2,
    asa_seconds: 7.4,
    mobility_sla_pct: 90.8,
  },
  "Avery Kim": {
    avg_ack_seconds: 118,
    ack_under_5_pct: 91.7,
    carrier_open_sla_pct: 93.8,
    refused_calls: 0,
    asa_seconds: 4.9,
    mobility_sla_pct: 95.2,
  },
};

export type LeaderboardRow = {
  agent: string;
  team: string;
  value: number;
};

export function snapshotLeaderboards(): Record<string, LeaderboardRow[]> {
  const boards: Record<string, LeaderboardRow[]> = {};
  for (const person of STAFF) {
    const base = SNAPSHOT[person.name];
    if (!base) continue;
    for (const [key, value] of Object.entries(base)) {
      (boards[key] ??= []).push({
        agent: person.name,
        team: person.tier,
        value: value as number,
      });
    }
  }
  return boards;
}

export function snapshotOverview() {
  const boards = snapshotLeaderboards();
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const kpis = Object.fromEntries(
    Object.entries(boards).map(([k, rows]) => [k, { value: avg(rows.map((r) => r.value)), n: rows.length }]),
  );
  const byTeam: Record<string, Record<string, number[]>> = {};
  for (const [key, rows] of Object.entries(boards)) {
    for (const r of rows) {
      byTeam[r.team] ??= {};
      (byTeam[r.team][key] ??= []).push(r.value);
    }
  }
  const order = TIERS.map((t) => t.slug);
  const teams = Object.entries(byTeam)
    .map(([slug, metrics]) => ({
      slug,
      metrics: Object.fromEntries(Object.entries(metrics).map(([k, vals]) => [k, avg(vals)])),
      n: Object.values(metrics)[0]?.length ?? 0,
    }))
    .sort((a, b) => order.indexOf(a.slug as (typeof order)[number]) - order.indexOf(b.slug as (typeof order)[number]));
  const rowCount = Object.values(boards).reduce((n, rows) => n + rows.length, 0);
  return { kpis, teams, rowCount };
}
