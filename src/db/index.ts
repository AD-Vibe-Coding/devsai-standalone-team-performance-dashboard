import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

let client: PGlite | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export { schema };

export const dbReady = (async () => {
  // IndexedDB in the browser — a filesystem path calls Node path.resolve and throws
  // "o.resolve is not a function".
  client = await PGlite.create("idb://team-performance");
  dbInstance = drizzle(client, { schema });
  const db = dbInstance;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS staff (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      team_slug TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS import_batches (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      status TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      error_summary TEXT,
      imported_by TEXT NOT NULL,
      period_start TEXT,
      period_end TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS metric_records (
      id SERIAL PRIMARY KEY,
      period_date TEXT NOT NULL,
      team_slug TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      metric_key TEXT NOT NULL,
      metric_value REAL NOT NULL,
      import_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS disputes (
      id SERIAL PRIMARY KEY,
      metric_record_id INTEGER NOT NULL,
      raised_by TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      reviewer TEXT,
      review_note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await seedSnapshotIfEmpty(db);
  return db;
})();

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    if (!dbInstance) {
      throw new Error("Database is not ready. Await dbReady first.");
    }
    return (dbInstance as unknown as Record<string | symbol, unknown>)[prop];
  },
});
