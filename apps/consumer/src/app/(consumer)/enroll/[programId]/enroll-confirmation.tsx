"use client";

import { useEffect, useState } from "react";
import type { WelcomeOffer } from "@mi-pasaporte/domain/server/consumer/enroll-landing";
import styles from "./enroll-confirmation.module.css";

const EXISTING_ACCOUNT_NOTICE =
  "Ya tienes una cuenta con ese teléfono: te enrolaste en el programa con tus datos.";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function EnrollConfirmation({
  firstName,
  businessName,
  welcomeOffer,
  existingAccount,
}: {
  firstName: string;
  businessName: string;
  welcomeOffer: WelcomeOffer | null;
  existingAccount: boolean;
}) {
  const [platform, setPlatform] = useState<"ios" | "android" | "other" | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(
      /iphone|ipad|ipod/i.test(ua)
        ? "ios"
        : /android/i.test(ua)
          ? "android"
          : "other",
    );
    setInstalled(isStandalone());
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setShowManual(true);
      return;
    }
    const prompt = installPrompt;
    setInstallPrompt(null);
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome !== "accepted") setShowManual(true);
  }

  return (
    <section className={styles.confirmation}>
      {existingAccount && (
        <p role="status" className={styles.accountNotice}>
          {EXISTING_ACCOUNT_NOTICE}
        </p>
      )}
      <div className={styles.hero}>
        <div className={styles.appIcon} aria-hidden="true">
          C
        </div>
        <span className={styles.step}>
          PASO 1 DE 2 · TU REGISTRO ESTÁ LISTO
        </span>
        <h1>¡Listo, {firstName}!</h1>
        <p>
          Ya sos parte del programa de <strong>{businessName}</strong>. Poné
          CheckPass en tu inicio para encontrar tus beneficios siempre a mano.
        </p>
      </div>

      <div
        className={styles.benefits}
        aria-label="Beneficios de tener CheckPass en el inicio"
      >
        <div>
          <span aria-hidden="true">⌁</span>
          <p>Todos tus programas en un lugar</p>
        </div>
        <div>
          <span aria-hidden="true">✦</span>
          <p>Cupones y ofertas para vos</p>
        </div>
        <div>
          <span aria-hidden="true">↗</span>
          <p>Acceso rápido desde tu inicio</p>
        </div>
      </div>

      {welcomeOffer && (
        <div className={styles.reward}>
          <span className={styles.rewardIcon} aria-hidden="true">
            ✦
          </span>
          <div>
            <strong>Te espera un beneficio de bienvenida</strong>
            <small>
              Abrí CheckPass desde tu inicio y activá las notificaciones para
              descubrirlo, sujeto a disponibilidad.
            </small>
          </div>
        </div>
      )}

      <div className={styles.installArea}>
        {installed ? (
          <p className={styles.installed}>
            CheckPass ya está en tu inicio ✓ Abrilo desde su ícono para
            continuar.
          </p>
        ) : platform === "android" ? (
          <>
            <button
              className={styles.installButton}
              type="button"
              onClick={install}
            >
              {installPrompt
                ? "Añadir CheckPass a mi inicio"
                : "Cómo añadir CheckPass a mi inicio"}
              <span aria-hidden="true">↗</span>
            </button>
            {showManual && (
              <p className={styles.instructions}>
                En Chrome, abrí el menú <strong>⋮</strong> y elegí{" "}
                <strong>Instalar app</strong>. Si ya está instalado, abrilo
                desde el ícono de CheckPass.
              </p>
            )}
          </>
        ) : platform === "ios" ? (
          <div className={styles.iosSteps}>
            <strong>Añadí CheckPass a tu inicio</strong>
            <ol>
              <li>
                En Safari, tocá <strong>Compartir</strong>.
              </li>
              <li>
                Elegí <strong>Añadir a pantalla de inicio</strong>.
              </li>
              <li>
                Tocá <strong>Añadir</strong> y abrí CheckPass desde su ícono.
              </li>
            </ol>
            <p>Si abriste el QR en otra app, abrí esta página en Safari.</p>
          </div>
        ) : platform === null ? (
          <p className={styles.loading}>Preparando tu instalación…</p>
        ) : (
          <a className={styles.installButton} href="/wallet">
            Abrir CheckPass <span aria-hidden="true">↗</span>
          </a>
        )}
        <p className={styles.nextStep}>
          Después, dentro de CheckPass, activás los avisos para recibir tus
          beneficios.
        </p>
      </div>
      <a className={styles.skipLink} href="/wallet">
        Ver mi pase ahora
      </a>
    </section>
  );
}
