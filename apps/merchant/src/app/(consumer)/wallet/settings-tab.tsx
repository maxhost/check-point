"use client";

import { useState } from "react";
import type { ConsumerProgramSummary } from "../../../server/consumer/programs";

/**
 * Spec 0065, fase D — «Configuración»: un interruptor de promociones por negocio.
 *
 * ENCENDIDO POR DEFECTO, y eso es una decisión del producto, no un detalle: escanear ya es
 * alta + consentimiento (ADR 0033 §2), así que lo que se persiste es el APAGADO
 * (`marketing_opt_out_at`). Por eso el estado del switch es `!marketingOptOut`.
 *
 * EL OPTIMISMO ES DELIBERADO: el switch se mueve al tocarlo y se REVIERTE si el servidor
 * dice que no. Un interruptor que tarda 300 ms en moverse se toca dos veces, y el segundo
 * toque manda la orden contraria.
 *
 * LO QUE ESTA PANTALLA NO TOCA, dicho acá y abajo en pantalla: los avisos transaccionales y
 * el saldo en el pase. El saldo propio no es publicidad (ADR 0065 §1) y apagar promociones
 * no lo apaga.
 */
export function SettingsTab({
  programs,
}: {
  programs: ConsumerProgramSummary[];
}) {
  return (
    <section aria-labelledby="settings-tab-title">
      <div className="consumer-programs-heading">
        <div>
          <h2 id="settings-tab-title">Configuración</h2>
          <p>Elegí de qué comercios querés recibir promociones.</p>
        </div>
      </div>
      {programs.length ? (
        <div className="consumer-settings-list">
          {programs.map((program) => (
            <MarketingSwitch key={program.membershipId} program={program} />
          ))}
          <p className="consumer-settings-note">
            Si lo apagás dejás de recibir promociones de ese comercio. Los
            avisos de tus puntos y sellos, y tu saldo en el pase, siguen igual.
          </p>
        </div>
      ) : (
        <div className="consumer-empty">
          <h3>Todavía no hay nada que configurar</h3>
          <p>Sumate a un programa y vas a poder elegir qué recibís.</p>
        </div>
      )}
    </section>
  );
}

function MarketingSwitch({ program }: { program: ConsumerProgramSummary }) {
  const [on, setOn] = useState(!program.marketingOptOut);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle(next: boolean) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setOn(next);
    try {
      const response = await fetch("/api/public/consumer/marketing-opt-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // El cuerpo manda el OPT-OUT, no el estado del switch: la columna guarda el
        // apagado y traducir acá evita que el servidor tenga que invertir nada.
        body: JSON.stringify({ programId: program.programId, optOut: !next }),
      });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      setOn(!next);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="consumer-settings-row">
      <label>
        <input
          type="checkbox"
          checked={on}
          disabled={busy}
          onChange={(event) => void toggle(event.target.checked)}
        />{" "}
        Promociones de {program.businessName}
      </label>
      {failed && (
        <p role="status" className="consumer-settings-error">
          No pudimos guardarlo. Probá de nuevo.
        </p>
      )}
    </div>
  );
}
