"use client";

import { useEffect, useState } from "react";
import { Button } from "../../../../../../ui";

/**
 * Spec 0150 — TEMPORAL. Botones de QA para entrar sin link magico a las 3 cuentas de
 * prueba. Solo se muestran si `GET /api/merchant/auth/qa-login` responde 200, o sea si
 * `QA_LOGIN_ENABLED` esta prendida en el servidor. Se borra al terminar las pruebas.
 */
type QaAccount = { account: string; label: string };

export function QaLoginButtons() {
  const [accounts, setAccounts] = useState<QaAccount[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/merchant/auth/qa-login", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { accounts?: QaAccount[] } | null) => {
        if (active && body?.accounts) setAccounts(body.accounts);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (accounts.length === 0) return null;

  async function enter(account: string) {
    setPending(account);
    setFailed(false);
    try {
      const response = await fetch("/api/merchant/auth/qa-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account }),
      });
      const body = (await response.json()) as { redirectTo?: string };
      if (!response.ok || !body.redirectTo) throw new Error("qa-login");
      window.location.assign(body.redirectTo);
    } catch {
      setFailed(true);
      setPending(null);
    }
  }

  return (
    <section className="mt-8 grid gap-3" aria-label="Acceso de prueba">
      <p className="text-xs font-bold uppercase text-content-muted">
        Acceso de prueba (QA)
      </p>
      {accounts.map(({ account, label }) => (
        <Button
          key={account}
          variant="quiet"
          fullWidth
          isLoading={pending === account}
          onPress={() => void enter(account)}
        >
          Entrar como {label}
        </Button>
      ))}
      {failed ? (
        <p className="text-sm text-danger" role="alert">
          No pudimos entrar con la cuenta de prueba.
        </p>
      ) : null}
    </section>
  );
}
