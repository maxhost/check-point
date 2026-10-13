"use client";

import { useEffect, useState } from "react";
import type { WelcomeOffer } from "@mi-pasaporte/domain/server/consumer/enroll-landing";
import styles from "../../consumer-entry.module.css";
import { CheckPassIcon, EntryIcon } from "../../entry-icons";
import { WelcomeOffer as WelcomeOfferCard } from "./welcome-offer";

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
}: {
  firstName: string;
  businessName: string;
  welcomeOffer: WelcomeOffer | null;
}) {
  const [platform, setPlatform] = useState<"ios" | "android" | "other" | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );
  const [showManual, setShowManual] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

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
      setInstallError(null);
      setShowManual(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (installing) return;
    if (!installPrompt) {
      setShowManual(true);
      return;
    }
    const prompt = installPrompt;
    setInstallPrompt(null);
    setInstalling(true);
    setInstallError(null);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome !== "accepted") setShowManual(true);
    } catch {
      setInstallError(
        "No pudimos abrir la instalación. CheckPass también se puede añadir desde el menú de Chrome.",
      );
      setShowManual(true);
    } finally {
      setInstalling(false);
    }
  }

  return (
    <section
      aria-label={
        firstName.trim()
          ? `Registro confirmado para ${firstName.trim()}`
          : "Registro confirmado"
      }
    >
      <div className={styles.confirmationHero}>
        <span className={styles.membershipSeal}>
          <EntryIcon name="check" />
        </span>
        <h1>¡Inscripción lista!</h1>
        <strong>{businessName}</strong>
      </div>
      {welcomeOffer && <WelcomeOfferCard offer={welcomeOffer} />}
      <section
        className={styles.installSection}
        aria-labelledby="install-title"
      >
        <div className={styles.installHeading}>
          <CheckPassIcon className={styles.appIcon} />
          <h2 id="install-title">
            Beneficios
            <br />
            siempre a mano
          </h2>
        </div>
        <p>
          Con CheckPass en la pantalla de inicio, el pase y todos los programas
          quedan siempre a mano.
        </p>
        <div className={styles.installArea}>
          {installed ? (
            <p className={styles.installed} role="status">
              <EntryIcon name="check" />
              CheckPass ya está en la pantalla de inicio. Para continuar,
              abrirlo desde su icono.
            </p>
          ) : platform === "android" ? (
            <>
              <button
                className={styles.primary}
                type="button"
                onClick={install}
                disabled={installing}
                aria-busy={installing}
              >
                {installing
                  ? "Abriendo instalación…"
                  : installPrompt
                    ? "Añadir CheckPass a mi inicio"
                    : "Cómo añadir CheckPass a mi inicio"}
                <EntryIcon name="add" />
              </button>
              {showManual && (
                <p className={styles.instructions}>
                  En Chrome, abrir el menú y elegir{" "}
                  <strong>Instalar app</strong> o{" "}
                  <strong>Añadir a pantalla de inicio</strong>. Si ya está
                  instalada, abrirla desde el icono de CheckPass.
                </p>
              )}
            </>
          ) : platform === "ios" ? (
            <>
              <ol className={styles.installSteps}>
                <li>
                  <span className={styles.stepNumber}>1</span>
                  <p>
                    En Safari, tocar <strong>Compartir</strong>.
                  </p>
                  <EntryIcon name="share" />
                </li>
                <li>
                  <span className={styles.stepNumber}>2</span>
                  <p>
                    Elegir <strong>Añadir a pantalla de inicio</strong>.
                  </p>
                  <EntryIcon name="add" />
                </li>
                <li>
                  <span className={styles.stepNumber}>3</span>
                  <p>
                    Tocar <strong>Añadir</strong> y abrir CheckPass desde su
                    icono.
                  </p>
                  <EntryIcon name="check" />
                </li>
              </ol>
            </>
          ) : platform === null ? (
            <p role="status">Preparando la instalación…</p>
          ) : (
            <a className={styles.primary} href="/wallet">
              Abrir CheckPass <EntryIcon name="arrow" />
            </a>
          )}
        </div>
        {installError && (
          <p role="alert" className={styles.error}>
            {installError}
          </p>
        )}
        {!installed && platform === "ios" && (
          <p className={styles.installNote}>
            Si el QR se abrió en otra app, abrir esta página en Safari.
          </p>
        )}
        <p className={styles.installNote}>
          Después, dentro de CheckPass, activar los avisos para recibir los
          beneficios.
        </p>
        <a className={styles.passLink} href="/wallet">
          Ver mi pase ahora <EntryIcon name="arrow" />
        </a>
      </section>
    </section>
  );
}
