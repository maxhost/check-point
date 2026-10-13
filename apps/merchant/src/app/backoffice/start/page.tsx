import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../server/auth-guards";
import { enabledModuleIds } from "../../../modules/activation";
import { startPageFor } from "../../../modules/start-page";

export const dynamic = "force-dynamic";

/**
 * Spec 0220 / ADR 0141 §2 — `/backoffice/start`, DONDE ABRE LA PWA (`app/manifest.ts`). Pagina del
 * core, solo servidor: sesion de backoffice (con sus rebotes de estado, cobro y PIN temporal) → el
 * primer modulo ENCENDIDO del registro con `startPage` cuyo permiso tiene el usuario (el owner los
 * tiene todos) → su pagina; si no hay, el panel. Nunca nombra un modulo.
 */
export default async function StartPage() {
  const session = await requireBackofficeSession();
  const target = startPageFor(await enabledModuleIds(session.business.id), {
    isOwner: session.membership.role === "owner",
    permissions: session.membership.permissions,
  });
  redirect(target ?? "/backoffice");
}
