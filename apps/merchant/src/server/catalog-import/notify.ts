import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { catalogImports, memberships, users } from "../schema";
import { emailChannelFromEnv } from "../email/provider";
import type { EmailChannel } from "../email/channel";
import { touch } from "./quota";

/**
 * Spec 0090 §7 / ADR 0082 §12 — EL AVISO POR EMAIL, **una sola vez por import**.
 *
 * Que el proceso sea asincrono es una ventaja y se explota: el merchant sube, cierra la
 * pantalla y sigue con lo suyo. Para que eso no sea un pozo, el servidor avisa cuando el
 * menu quedo importado (y si falla). **Sale una sola vez y DESPUES del resultado final**
 * (spec 0091 §7): no hay estado intermedio que anunciar. Reusa el canal que ya existe (`server/email/`), asi que
 * en los tests sale por el fake de consola y se lee en `consoleEmailOutbox`.
 *
 * **La marca se RECLAMA antes de mandar** (`notified_at is null` en el `WHERE`, con
 * `returning`): si el callback y el reconciliador llegan a la vez, solo uno de los dos gana
 * la fila y el merchant no recibe dos mails. Un fallo del proveedor de email **no** revierte
 * la marca: reintentarlo indefinidamente cuesta mas que un aviso perdido, y el estado del
 * import se puede consultar igual.
 *
 * **No hay push** (ADR 0082 §12): el push al backoffice es otra feature.
 */
export type NotifyOutcome =
  | "sent"
  | "already_notified"
  | "no_recipient"
  | "failed";

export async function notifyImportFinished(
  importId: string,
  outcome: "accepted" | "failed",
  channel?: EmailChannel,
): Promise<NotifyOutcome> {
  const [claimed] = await getDb()
    .update(catalogImports)
    .set({ notifiedAt: new Date(), ...touch() })
    .where(
      and(eq(catalogImports.id, importId), isNull(catalogImports.notifiedAt)),
    )
    .returning({
      id: catalogImports.id,
      businessId: catalogImports.businessId,
      createdByUserId: catalogImports.createdByUserId,
    });
  if (!claimed) return "already_notified";
  const to = await recipientFor(claimed.businessId, claimed.createdByUserId);
  if (!to) return "no_recipient";
  try {
    const mail = catalogImportEmail(outcome);
    await (channel ?? emailChannelFromEnv()).sendEmail({ to, ...mail });
    return "sent";
  } catch {
    return "failed";
  }
}

/**
 * **El aviso es para EL NEGOCIO, no solo para quien subio el archivo** (decision del
 * orquestador, 2026-09-22; reversible).
 *
 * El primer destinatario es quien pidio el analisis, que es lo mas util. Pero un integrante
 * nace con el email sintetico `staff-<uuid>@staff.invalid` (`staff-create.ts:132`), que
 * **nunca se entrega**: con solo ese candidato, un import pedido por un integrante no le
 * llegaba a **nadie**, y la decision del owner dice «email al merchant». Por eso cae al
 * **owner activo del negocio**, y solo si ese buzon tampoco sirve devuelve `no_recipient`.
 */
async function recipientFor(
  businessId: string,
  createdByUserId: string,
): Promise<string | null> {
  const [autor] = await getDb()
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, createdByUserId))
    .limit(1);
  if (usable(autor?.email)) return autor.email;
  const [owner] = await getDb()
    .select({ email: users.email })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .where(
      and(
        eq(memberships.businessId, businessId),
        eq(memberships.role, "owner"),
        eq(memberships.status, "active"),
      ),
    )
    .limit(1);
  return usable(owner?.email) ? owner.email : null;
}

/** Un buzon que se puede entregar. `@staff.invalid` es el dominio sintetico del staff. */
function usable(email: string | null | undefined): email is string {
  return typeof email === "string" && email.length > 0
    ? !email.endsWith("@staff.invalid")
    : false;
}

/** El cuerpo. **Sin nombres de productos ni fragmentos del menu**: el aviso dice que el
 * trabajo termino, no que decia el documento (§9). */
export function catalogImportEmail(outcome: "accepted" | "failed"): {
  subject: string;
  html: string;
  text: string;
} {
  const importado = outcome === "accepted";
  const subject = importado
    ? "Tu menú ya está en el catálogo"
    : "No pudimos leer tu menú";
  const line = importado
    ? "Terminamos de leer tu menú y ya está en tu catálogo. Entrá para revisarlo y completar lo que haya quedado sin precio."
    : "No pudimos leer el archivo que subiste. Podés intentarlo de nuevo con otras fotos o un PDF.";
  const text = `${line} CheckPass Club · Negocios`;
  const html = `<!doctype html>
<html lang="es">
  <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; margin: 0; padding: 24px;">
    <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #666;">CheckPass Club · Negocios</p>
    <h1 style="font-size: 20px; margin: 8px 0 16px;">${subject}</h1>
    <p style="margin: 0 0 16px;">${line}</p>
  </body>
</html>`;
  return { subject, html, text };
}
