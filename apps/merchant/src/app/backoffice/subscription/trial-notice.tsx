"use client";

import { usePathname } from "next/navigation";
import { MODULES } from "../../../modules/registry";
import { Alert, Link } from "../../../ui";
import { useBackofficeContext } from "../backoffice-context";

/** Usa el número de días del contrato de sesión; no recalcula fechas. */
export function TrialNotice() {
  const pathname = usePathname();
  const { state } = useBackofficeContext();
  const core = state.core;
  const days =
    core?.membership.role === "owner" && core.billing.access === "trial"
      ? core.billing.trialDaysLeft
      : null;
  const isOperation = MODULES.some(
    (module) =>
      module.operation &&
      (pathname === `/backoffice/${module.id}` ||
        pathname.startsWith(`/backoffice/${module.id}/`)),
  );
  if (
    days === null ||
    pathname === "/backoffice/subscription" ||
    (isOperation && days > 7)
  )
    return null;
  return (
    <Alert
      title={`Prueba de CheckPass: ${days === 1 ? "queda 1 día" : `quedan ${days} días`}`}
      className="mb-6 print:hidden"
    >
      Al terminar necesitas un plan activo para continuar.{" "}
      <Link href="/backoffice/subscription">Elegir un plan</Link>
    </Alert>
  );
}
