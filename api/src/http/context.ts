import type { Database } from "../db/client.ts";
import type { Env } from "../config/env.ts";
import { SecretBox } from "../lib/crypto.ts";
import { SecretStore } from "../services/secrets.ts";

/** Dependencias que comparten todas las rutas. Se arman una vez al levantar el servidor. */
export interface AppContext {
  readonly db: Database;
  readonly env: Env;
  readonly secrets: SecretStore;
}

export function createContext(db: Database, env: Env): AppContext {
  return { db, env, secrets: new SecretStore(db, new SecretBox(env.APP_ENCRYPTION_KEY)) };
}

/** Usuario del panel o cliente autenticado en la petición en curso. */
export type Principal =
  | { readonly kind: "user"; readonly id: string; readonly role: "admin" | "staff"; readonly name: string }
  | { readonly kind: "client"; readonly id: string; readonly name: string };

export interface Variables {
  principal?: Principal;
}
