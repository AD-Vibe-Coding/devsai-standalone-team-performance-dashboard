import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";

/** Teams shown in filters and KPI rollups. Edit names here, then Push to Supabase. */
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/** Roster + role mapping. Treat as app-specific — update rows, not code, when people change. */
export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  team_slug: text("team_slug").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const import_batches = pgTable("import_batches", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  status: text("status").notNull(),
  row_count: integer("row_count").notNull(),
  error_summary: text("error_summary"),
  imported_by: text("imported_by").notNull(),
  period_start: text("period_start"),
  period_end: text("period_end"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const metric_records = pgTable("metric_records", {
  id: serial("id").primaryKey(),
  period_date: text("period_date").notNull(),
  team_slug: text("team_slug").notNull(),
  agent_name: text("agent_name").notNull(),
  metric_key: text("metric_key").notNull(),
  metric_value: real("metric_value").notNull(),
  import_id: integer("import_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const disputes = pgTable("disputes", {
  id: serial("id").primaryKey(),
  metric_record_id: integer("metric_record_id").notNull(),
  raised_by: text("raised_by").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull(),
  reviewer: text("reviewer"),
  review_note: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
