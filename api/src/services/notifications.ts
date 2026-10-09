import { and, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "../db/client.ts";
import { clients, emailLog, packs } from "../db/schema.ts";
import { todayInStudio } from "../lib/dates.ts";
import type { SecretStore } from "./secrets.ts";
import { readSettings } from "./settings.ts";

/**
 * Emails transaccionales con Resend. Si falta la credencial, no se envía nada y se deja
 * constancia en el log: el sistema sigue funcionando sin emails configurados.
 */

export interface SendResult {
  readonly sent: number;
  readonly skipped: number;
  readonly reason?: string;
}

async function deliver(
  secrets: SecretStore,
  message: { to: string; subject: string; html: string },
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = await secrets.get("RESEND_API_KEY");
  const from = await secrets.get("RESEND_FROM");
  if (!apiKey || !from) return { ok: false, error: "Credenciales de email no configuradas." };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return { ok: false, error: `Resend respondió ${response.status}.` };
  return { ok: true };
}

function expiryTemplate(name: string, endsOn: string, studioName: string): { subject: string; html: string } {
  return {
    subject: `Tu abono venció el ${endsOn}`,
    html: `<p>Hola ${name},</p>
<p>Te contamos que tu abono en ${studioName} venció el ${endsOn}.</p>
<p>Para seguir reservando clases, podés renovarlo desde tu cuenta o escribirnos.</p>
<p>¡Te esperamos!<br>${studioName}</p>`,
  };
}

/**
 * Avisa por email a los clientes cuyo abono venció y todavía no fueron notificados.
 * `expiry_notified_at` evita repetir el aviso si la tarea corre más de una vez.
 */
export async function sendExpiryNotices(db: Database, secrets: SecretStore): Promise<SendResult> {
  const config = await readSettings(db);
  if (!config["notifications.expiryEmail"]) return { sent: 0, skipped: 0, reason: "Avisos desactivados." };

  const pending = await db
    .select({
      packId: packs.id,
      clientId: clients.id,
      name: clients.name,
      email: clients.email,
      endsOn: packs.endsOn,
    })
    .from(packs)
    .innerJoin(clients, eq(clients.id, packs.clientId))
    .where(
      and(
        eq(packs.status, "expired"),
        isNull(packs.expiryNotifiedAt),
        sql`${packs.endsOn} >= ${todayInStudio()}::date - 7`,
      ),
    )
    .limit(100);

  let sent = 0;
  let skipped = 0;
  for (const row of pending) {
    if (!row.email) {
      skipped += 1;
      await db.update(packs).set({ expiryNotifiedAt: new Date() }).where(eq(packs.id, row.packId));
      continue;
    }
    const template = expiryTemplate(row.name, row.endsOn, config["studio.name"]);
    const result = await deliver(secrets, { to: row.email, ...template });
    await db.insert(emailLog).values({
      clientId: row.clientId,
      kind: "pack_expired",
      to: row.email,
      subject: template.subject,
      status: result.ok ? "sent" : "failed",
      error: result.error ?? null,
    });
    if (result.ok) {
      sent += 1;
      await db.update(packs).set({ expiryNotifiedAt: new Date() }).where(eq(packs.id, row.packId));
    } else {
      skipped += 1;
    }
  }
  return { sent, skipped };
}
