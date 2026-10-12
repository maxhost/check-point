"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Alert, Link } from "../../../ui";

/** Usa el número de días del contrato de sesión; no recalcula fechas. */
export function TrialNotice() {
  const pathname = usePathname();
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/merchant/session", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((session) => {
        if (
          !controller.signal.aborted &&
          session?.billing?.access === "trial"
        ) {
          setDays(session.billing.trialDaysLeft);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const isPos =
    pathname === "/backoffice/pos" || pathname.startsWith("/backoffice/pos/");
  if (
    days === null ||
    pathname === "/backoffice/subscription" ||
    (isPos && days > 7)
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
