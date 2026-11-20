import { ROSTER, TIERS } from "./roster";
import type { KpiKey } from "./kpis";
import type { VolumeKey } from "./volumes";

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

const VOLUMES: Record<string, Record<VolumeKey, number>> = {
  "Priya Shah": {
    tickets_received: 412,
    inbound_calls: 286,
    outbound_calls: 94,
    mobility_tasks: 61,
  },
  "Marcus Chen": {
    tickets_received: 338,
    inbound_calls: 241,
    outbound_calls: 118,
    mobility_tasks: 47,
  },
  "Sam Okonkwo": {
    tickets_received: 305,
    inbound_calls: 198,
    outbound_calls: 132,
    mobility_tasks: 39,
  },
  "Avery Kim": {
    tickets_received: 274,
    inbound_calls: 167,
    outbound_calls: 88,
    mobility_tasks: 72,
  },
};

export type LeaderboardRow = {
  agent: string;
  team: string;
  value: number;
};

export type VolumeTotals = Record<VolumeKey, number>;

const EMPTY_VOLUMES: VolumeTotals = {
  tickets_received: 0,
  inbound_calls: 0,
  outbound_calls: 0,
  mobility_tasks: 0,
};

function addVolumes(a: VolumeTotals, b: VolumeTotals): VolumeTotals {
  return {
    tickets_received: a.tickets_received + b.tickets_received,
    inbound_calls: a.inbound_calls + b.inbound_calls,
    outbound_calls: a.outbound_calls + b.outbound_calls,
    mobility_tasks: a.mobility_tasks + b.mobility_tasks,
  };
}

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

  const volumesByTier: Record<string, VolumeTotals> = {};
  let volumes: VolumeTotals = { ...EMPTY_VOLUMES };
  for (const person of STAFF) {
    const v = VOLUMES[person.name];
    if (!v) continue;
    volumes = addVolumes(volumes, v);
    volumesByTier[person.tier] = addVolumes(volumesByTier[person.tier] ?? EMPTY_VOLUMES, v);
  }

  const order = TIERS.map((t) => t.slug);
  const teams = Object.entries(byTeam)
    .map(([slug, metrics]) => ({
      slug,
      metrics: Object.fromEntries(Object.entries(metrics).map(([k, vals]) => [k, avg(vals)])),
      n: Object.values(metrics)[0]?.length ?? 0,
      volumes: volumesByTier[slug] ?? { ...EMPTY_VOLUMES },
    }))
    .sort(
      (a, b) =>
        order.indexOf(a.slug as (typeof order)[number]) - order.indexOf(b.slug as (typeof order)[number]),
    );
  const rowCount = Object.values(boards).reduce((n, rows) => n + rows.length, 0);
  return { kpis, teams, rowCount, volumes };
}
