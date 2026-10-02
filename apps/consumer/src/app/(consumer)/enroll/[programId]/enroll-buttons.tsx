"use client";

import { useState } from "react";
import { readableTextColor } from "@mi-pasaporte/domain/lib/brand-color";
import { ProviderButtons } from "../../provider-buttons";

/**
 * Spec 0119 / ADR 0111 §7 — EL ALTA DE UN TOQUE con sesion viva: «Sumarme como <nombre>» hace
 * el POST con la cookie (sin datos) y «No soy yo» muestra los dos botones de proveedor. No hay
 * alta automatica al abrir la pagina: el toque es el consentimiento.
 */
export function OneTapEnroll({
  programId,
  loc,
  firstName,
  primaryColor,
  isIos,
}: {
  programId: string;
  loc: string | null;
  firstName: string;
  primaryColor: string;
  isIos: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [notMe, setNotMe] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const name = firstName.trim();

  async function join() {
    if (submitting) return;
    setSubmitting(true);
    setToast(null);
    try {
      const res = await fetch(
        `/api/public/enroll/${encodeURIComponent(programId)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(loc ? { loc } : {}),
        },
      );
      if (res.status === 201) {
        // Navegacion completa: la confirmacion emite el manifest de la cuenta en su HTML.
        window.location.assign(
          `/enroll/${encodeURIComponent(programId)}/ready`,
        );
        return;
      }
      if (res.status === 409) {
        window.location.assign("/wallet");
        return;
      }
      if (res.status === 401) {
        setNotMe(true);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setToast(data.error ?? "No pudimos completar el registro.");
    } catch {
      setToast("Hubo un problema de conexión. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (notMe)
    return <ProviderButtons programId={programId} loc={loc} isIos={isIos} />;

  return (
    <div style={{ marginTop: 24 }}>
      <button
        type="button"
        onClick={join}
        disabled={submitting}
        style={{
          width: "100%",
          padding: "13px 14px",
          fontSize: 16,
          fontWeight: 600,
          borderRadius: 10,
          border: "none",
          background: primaryColor,
          color: readableTextColor(primaryColor),
          opacity: submitting ? 0.6 : 1,
          cursor: submitting ? "default" : "pointer",
        }}
      >
        {submitting ? "Sumándote…" : name ? `Sumarme como ${name}` : "Sumarme"}
      </button>
      <button
        type="button"
        onClick={() => setNotMe(true)}
        style={{
          display: "block",
          margin: "14px auto 0",
          background: "none",
          border: "none",
          color: "#555",
          fontSize: 14,
          textDecoration: "underline",
          cursor: "pointer",
        }}
      >
        No soy yo
      </button>
      {toast ? (
        <p
          role="alert"
          style={{ marginTop: 12, color: "#a1352c", fontSize: 14 }}
        >
          {toast}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Spec 0120 — EL ESTADO «YA SOS PARTE» CON SESION VIVA: dice con que cuenta se entro y ofrece
 * «No soy yo», que muestra los botones de proveedor (el callback reemplaza la sesion). Sin esto
 * una sesion vieja solo se cambiaba borrando los datos del navegador (QA del owner, 2026-10-02).
 */
export function MemberNotMe({
  programId,
  loc,
  businessName,
  firstName,
  primaryColor,
  isIos,
}: {
  programId: string;
  loc: string | null;
  businessName: string;
  firstName: string;
  primaryColor: string;
  isIos: boolean;
}) {
  const [notMe, setNotMe] = useState(false);
  const name = firstName.trim();
  if (notMe)
    return <ProviderButtons programId={programId} loc={loc} isIos={isIos} />;
  return (
    <section>
      <h2 style={{ fontSize: 20, marginTop: 20 }}>
        Ya sos parte de {businessName}
      </h2>
      {name ? (
        <p style={{ color: "#555", marginTop: 6 }}>Entraste como {name}.</p>
      ) : null}
      <a
        href="/wallet"
        style={{
          display: "block",
          marginTop: 20,
          padding: "13px 14px",
          borderRadius: 10,
          textAlign: "center",
          textDecoration: "none",
          fontWeight: 600,
          background: primaryColor,
          color: readableTextColor(primaryColor),
        }}
      >
        Ver mi tarjeta
      </a>
      <button
        type="button"
        onClick={() => setNotMe(true)}
        style={{
          display: "block",
          margin: "14px auto 0",
          background: "none",
          border: "none",
          color: "#555",
          fontSize: 14,
          textDecoration: "underline",
          cursor: "pointer",
        }}
      >
        No soy yo
      </button>
    </section>
  );
}
