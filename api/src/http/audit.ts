import type { Database } from "../db/client.ts";
import { auditLog } from "../db/schema.ts";

/**
 * Registro de acciones del panel: quién, qué y cuándo. Nunca guarda credenciales ni
 * contraseñas; para los secretos se anota sólo la clave afectada.
 */
export async function audit(
  db: Database,
  actor: { type: "user" | "client"; id: string } | null,
  action: string,
  entity: string,
  entityId: string | null,
  data: unknown,
): Promise<void> {
  await db.insert(auditLog).values({
    actorType: actor?.type ?? null,
    actorId: actor?.id ?? null,
    action,
    entity,
    entityId,
    data: data === undefined ? null : (data as object),
  });
}
