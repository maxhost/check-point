"use client";

import { useState } from "react";
import type { WelcomeOffer as Offer } from "@mi-pasaporte/domain/server/consumer/enroll-landing";
import { ProviderButtons } from "../../provider-buttons";
import { EnrollmentIntro } from "../../entry-brand";
import { EntryIcon } from "../../entry-icons";
import { WelcomeOffer } from "./welcome-offer";
import styles from "../../consumer-entry.module.css";

/**
 * Spec 0119 / ADR 0111 §7 — EL ALTA DE UN TOQUE con sesion viva: «Sumarme como <nombre>» hace
 * el POST con la cookie (sin datos) y «No soy yo» muestra los dos botones de proveedor. No hay
 * alta automatica al abrir la pagina: el toque es el consentimiento.
 */
export function OneTapEnroll({
  programId,
  loc,
  firstName,
  businessName,
  welcomeOffer,
  isIos,
}: {
  programId: string;
  loc: string | null;
  firstName: string;
  businessName: string;
  welcomeOffer: Offer | null;
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
      setToast("Hubo un problema de conexión. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <EnrollmentIntro
        businessName={businessName}
        firstName={firstName}
        signed={!notMe}
      />
      {welcomeOffer && <WelcomeOffer offer={welcomeOffer} />}
      {notMe ? (
        <>
          <ProviderButtons programId={programId} loc={loc} isIos={isIos} />
          <p className={styles.supportNote}>
            Al continuar, te unes al programa de este comercio con tu cuenta de
            CheckPass.
          </p>
        </>
      ) : (
        <div className={styles.joinActions}>
          <div className={styles.account}>
            <span className={styles.avatar}>
              <EntryIcon name="person" />
            </span>
            <div>
              <p>Has iniciado sesión como</p>
              <strong>{name || "Tu cuenta"}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={join}
            disabled={submitting}
            className={styles.primary}
            aria-busy={submitting}
          >
            {submitting ? "Uniéndote…" : "Unirme al programa"}
          </button>
          <button
            type="button"
            onClick={() => setNotMe(true)}
            className={styles.textAction}
            disabled={submitting}
          >
            No soy yo
          </button>
          {toast ? (
            <p role="alert" className={styles.error}>
              {toast}
            </p>
          ) : null}
        </div>
      )}
    </section>
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
  isIos,
}: {
  programId: string;
  loc: string | null;
  businessName: string;
  firstName: string;
  isIos: boolean;
}) {
  const [notMe, setNotMe] = useState(false);
  const name = firstName.trim();
  if (notMe)
    return (
      <>
        <EnrollmentIntro businessName={businessName} />
        <ProviderButtons programId={programId} loc={loc} isIos={isIos} />
        <p className={styles.supportNote}>
          Al continuar, te unes al programa de este comercio con tu cuenta de
          CheckPass.
        </p>
      </>
    );
  return (
    <section>
      <div className={styles.intro}>
        <h1>Ya eres parte de {businessName}</h1>
        <p>
          Tu programa ya está en tu wallet. Abre tu pase para ver tus
          beneficios.
        </p>
      </div>
      <div className={styles.joinActions}>
        <div className={styles.account}>
          <span className={styles.avatar}>
            <EntryIcon name="person" />
          </span>
          <div>
            <p>Has iniciado sesión como</p>
            <strong>{name || "Tu cuenta"}</strong>
          </div>
        </div>
        <a href="/wallet" className={styles.primary}>
          Ver mi pase
        </a>
        <button
          type="button"
          onClick={() => setNotMe(true)}
          className={styles.textAction}
        >
          No soy yo
        </button>
      </div>
    </section>
  );
}
