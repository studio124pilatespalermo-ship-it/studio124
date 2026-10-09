import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import pg from "pg";
import * as schema from "./schema.ts";

export const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** Las dos variantes exponen la misma API de consultas; el resto del código no distingue. */
export type Database = ReturnType<typeof drizzlePg<typeof schema>>;

export interface DatabaseHandle {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

/**
 * Producción: Postgres real (Railway, Neon, etc.) vía `DATABASE_URL`.
 * Desarrollo y tests: PGlite, un Postgres embebido; `dataDir` en disco o en memoria.
 */
export async function openDatabase(options: { url?: string | undefined; dataDir?: string }): Promise<DatabaseHandle> {
  if (options.url) {
    const pool = new pg.Pool({ connectionString: options.url, max: 10 });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder });
    return { db, close: () => pool.end() };
  }
  const client = new PGlite(options.dataDir ?? "memory://");
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  return { db: db as unknown as Database, close: () => client.close() };
}
