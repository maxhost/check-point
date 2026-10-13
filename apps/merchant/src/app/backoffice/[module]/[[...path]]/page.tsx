import { notFound } from "next/navigation";
import { requireBackofficeSession } from "../../../../server/auth-guards";
import { moduleScreen } from "../../../../modules/screen";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ module: string; path?: string[] }> };

/**
 * Spec 0216 / ADR 0139 §4 — `/backoffice/<id>/…`: UNA pagina para las pantallas de todos los
 * modulos. Sesion de backoffice (con sus rebotes de estado y cobro) → modulo del registro →
 * encendido para el negocio → owner o permiso de la entrada de menu → pantalla de `ui-registry`.
 * Cualquier «no» es `notFound()`: un modulo apagado o ajeno no se distingue de uno inexistente.
 * Nunca nombra un modulo.
 */
export default async function ModulePage({ params }: Props) {
  const session = await requireBackofficeSession();
  const { module, path } = await params;
  const Screen = await moduleScreen(session, module, path ?? []);
  if (!Screen) notFound();
  return <Screen />;
}
