import { loadEnv } from "../config/env.ts";
import { openDatabase } from "./client.ts";

/** Aplica las migraciones pendientes. `openDatabase` ya migra al abrir. */
const env = loadEnv();
const handle = await openDatabase({ url: env.DATABASE_URL, dataDir: "./.data/pg" });
console.log("[db] migraciones aplicadas.");
await handle.close();
