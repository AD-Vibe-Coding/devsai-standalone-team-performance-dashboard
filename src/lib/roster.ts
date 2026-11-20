/**
 * Source-app roster mapping. Update this list when people join or change teams.
 * Roles: "staff" can flag disputes; "manager" can import and review.
 */
export type RosterPerson = {
  name: string;
  email: string;
  team: string;
  role: "staff" | "manager";
};

export const TEAMS = [{ slug: "noc", name: "NOC" }] as const;

export const ROSTER: RosterPerson[] = [
  { name: "Jordan Hale", email: "jordan.hale@example.com", team: "noc", role: "manager" },
  { name: "Priya Shah", email: "priya.shah@example.com", team: "noc", role: "staff" },
  { name: "Marcus Chen", email: "marcus.chen@example.com", team: "noc", role: "staff" },
  { name: "Elena Rossi", email: "elena.rossi@example.com", team: "noc", role: "manager" },
  { name: "Sam Okonkwo", email: "sam.okonkwo@example.com", team: "noc", role: "staff" },
  { name: "Avery Kim", email: "avery.kim@example.com", team: "noc", role: "staff" },
  { name: "Chris Patel", email: "chris.patel@example.com", team: "noc", role: "manager" },
];
