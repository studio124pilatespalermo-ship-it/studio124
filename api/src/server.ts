import { serve } from "@hono/node-server";
import { loadEnv } from "./config/env.ts";
import { openDatabase } from "./db/client.ts";
import { createApp } from "./http/app.ts";
import { createContext } from "./http/context.ts";

const env = loadEnv();
const handle = await openDatabase({ url: env.DATABASE_URL, dataDir: "./.data/pg" });
const app = createApp(createContext(handle.db, env));

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`[api] escuchando en http://localhost:${info.port} (${env.NODE_ENV})`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void handle.close().finally(() => process.exit(0));
    });
  });
}
