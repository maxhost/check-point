"use client";

import { useState } from "react";

export function CredentialDialog({
  name,
  identifier,
  pin,
  regenerated,
  onClose,
}: {
  name: string;
  identifier: string;
  pin: string;
  regenerated: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const credential = `Identificador: ${identifier}\nPIN temporal: ${pin}`;
  async function copy() {
    await navigator.clipboard.writeText(credential);
    setCopied(true);
  }
  return (
    <div className="dialog-backdrop">
      <section aria-modal="true" className="credential-dialog" role="dialog">
        <p className="eyebrow">Credenciales de {name}</p>
        <h2>{regenerated ? "PIN regenerado" : "Integrante creado"}</h2>
        <p>
          Guardá y compartí estos datos ahora. El PIN se muestra una sola vez y
          no se envía por email.
          {regenerated && " Las sesiones anteriores quedaron cerradas."}
        </p>
        <dl>
          <div>
            <dt>Identificador</dt>
            <dd>{identifier}</dd>
          </div>
          <div>
            <dt>PIN temporal</dt>
            <dd>{pin}</dd>
          </div>
        </dl>
        <button
          className="button alt"
          data-tour="staff-credentials-copy"
          onClick={() => void copy()}
          type="button"
        >
          {copied ? "Copiado" : "Copiar credenciales"}
        </button>
        <button
          className="button"
          data-tour="staff-credentials-done"
          onClick={onClose}
          type="button"
        >
          Ya las guardé
        </button>
      </section>
    </div>
  );
}
