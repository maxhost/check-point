"use client";

import { useEffect, useState } from "react";
import { readableTextColor } from "@mi-pasaporte/domain/lib/brand-color";
import { WalletButtons } from "../../wallet-cta";
import { PushPrompt } from "../../push-prompt";
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

function AndroidInstallAction() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) {
      setShowManual((value) => !value);
      return;
    }
    const currentPrompt = prompt;
    setPrompt(null);
    await currentPrompt.prompt();
    const choice = await currentPrompt.userChoice;
    if (choice.outcome !== "accepted") setShowManual(true);
  }

  if (installed)
    return (
      <p className={styles.success}>Check Pass Club ya está en tu inicio ✓</p>
    );
  return (
    <>
      <button className={styles.homeButton} type="button" onClick={install}>
        {prompt ? "Añadir a mi pantalla de inicio" : "Cómo añadir a mi inicio"}
        <span aria-hidden="true">↗</span>
      </button>
      {showManual && (
        <p className={styles.instructions}>
          En Chrome, abrí el menú <strong>⋮</strong> y elegí{" "}
          <strong>Instalar app</strong> o{" "}
          <strong>Añadir a pantalla de inicio</strong>. Si abriste el QR en otra
          app, abrí esta página en Chrome primero.
        </p>
      )}
    </>
  );
}

function ActionIcon({ kind }: { kind: "bell" | "wallet" | "home" }) {
  const paths = {
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
        <path d="M10 21h4" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="3" />
        <path d="M3 9h18M16 15h2" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9Z" />
        <path d="M9 21v-7h6v7" />
      </>
    ),
  };
  return (
    <span className={styles.icon} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths[kind]}
      </svg>
    </span>
  );
}

function Action({
  number,
  icon,
  title,
  featured = false,
  children,
}: {
  number: string;
  icon: "bell" | "wallet" | "home";
  title: string;
  featured?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        featured ? `${styles.action} ${styles.featured}` : styles.action
      }
    >
      <div className={styles.actionTop}>
        <span className={styles.number}>{number}</span>
        <ActionIcon kind={icon} />
      </div>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function EnrollConfirmation({
  firstName,
  businessName,
  brandPrimaryColor,
  vapidPublicKey,
  walletManifestPath,
  existingAccount,
}: {
  firstName: string;
  businessName: string;
  brandPrimaryColor: string;
  vapidPublicKey: string | null;
  walletManifestPath: string | null;
  existingAccount: boolean;
}) {
  const [platform, setPlatform] = useState<"ios" | "android" | "other" | null>(
    null,
  );
  const [standalone, setStandalone] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);

  // The icon must open this consumer's wallet, so install metadata is injected
  // only after the enrollment response provides its tokenized manifest URL.
  useEffect(() => {
    if (!walletManifestPath) return;
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = walletManifestPath;
    document.head.appendChild(link);
    return () => link.remove();
  }, [walletManifestPath]);

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(
      /iphone|ipad|ipod/i.test(ua)
        ? "ios"
        : /android/i.test(ua)
          ? "android"
          : "other",
    );
    setStandalone(isStandalone());
    setPushSupported(
      "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window,
    );
  }, []);

  const isIos = platform === "ios";
  const needsIosInstall = isIos && !standalone;
  const showPush = Boolean(vapidPublicKey) && pushSupported && !needsIosInstall;
  const brandStyle = {
    "--brand": brandPrimaryColor,
    "--brand-ink": readableTextColor(brandPrimaryColor),
  } as React.CSSProperties;

  return (
    <section className={styles.confirmation} style={brandStyle}>
      {existingAccount && (
        <p role="status" className={styles.accountNotice}>
          {EXISTING_ACCOUNT_NOTICE}
        </p>
      )}
      <div className={styles.hero}>
        <div className={styles.heroMark} aria-hidden="true">
          ✓
        </div>
        <p className={styles.eyebrow}>TU REGISTRO ESTÁ LISTO</p>
        <h2>¡Listo, {firstName}!</h2>
        <p>
          Tu pase de <strong>{businessName}</strong> está listo. Completá estos
          pasos para aprovecharlo al máximo.
        </p>
      </div>
      {platform === null ? (
        <p className={styles.loading}>Preparando tus próximos pasos…</p>
      ) : (
        <div className={styles.actions}>
          {needsIosInstall && (
            <Action
              number="01"
              icon="home"
              title="Tené CheckPass en tu inicio"
              featured
            >
              <p>
                Entrá a todos tus programas, cupones y ofertas desde un solo
                lugar.
              </p>
              <div className={styles.iosSteps}>
                <span>
                  1. En Safari, tocá <strong>Compartir</strong> (o{" "}
                  <strong>···</strong> y luego <strong>Compartir</strong>).
                </span>
                <span>
                  2. Elegí <strong>Añadir a pantalla de inicio</strong>.
                </span>
                <span>
                  3. Tocá <strong>Añadir</strong> y abrí CheckPass desde el
                  ícono.
                </span>
              </div>
              <p className={styles.smallNote}>
                Si estás en otra app, abrí esta página en Safari.
              </p>
            </Action>
          )}
          {platform === "android" && (
            <Action
              number="01"
              icon="bell"
              title="Activá los avisos de beneficios"
              featured
            >
              {showPush ? (
                <PushPrompt
                  vapidPublicKey={vapidPublicKey}
                  accentColor={brandPrimaryColor}
                  embedded
                />
              ) : (
                <p>
                  Recibí avisos de ofertas y premios antes de que venzan. Podrás
                  activarlos desde tu pase cuando estén disponibles.
                </p>
              )}
            </Action>
          )}
          <Action
            number={needsIosInstall || platform === "android" ? "02" : "01"}
            icon="wallet"
            title="Guardá tu pase en Wallet"
          >
            <p>
              Tenelo a mano incluso sin conexión para usar tus beneficios en
              comercios adheridos.
            </p>
            <WalletButtons isIos={isIos} />
          </Action>
          {platform === "android" && (
            <Action number="03" icon="home" title="Añadí CheckPass a tu inicio">
              <p>
                Encontrá todos tus programas, cupones, ofertas y descuentos
                especiales en un toque.
              </p>
              {walletManifestPath ? (
                <AndroidInstallAction />
              ) : (
                <p className={styles.smallNote}>
                  Abrí tu pase para añadir CheckPass al inicio.
                </p>
              )}
            </Action>
          )}
          {needsIosInstall && vapidPublicKey && (
            <Action number="03" icon="bell" title="Activá las notificaciones">
              <p>
                Después de añadir CheckPass al inicio, abrilo desde su ícono y
                activá las notificaciones en tu pase. Así recibirás avisos de
                ofertas cercanas y premios antes de que venzan.
              </p>
            </Action>
          )}
          {isIos && standalone && showPush && (
            <Action
              number="02"
              icon="bell"
              title="Activá las notificaciones"
              featured
            >
              <PushPrompt
                vapidPublicKey={vapidPublicKey}
                accentColor={brandPrimaryColor}
                embedded
              />
            </Action>
          )}
        </div>
      )}
      <a className={styles.walletLink} href="/wallet">
        Ver mi pase y código QR <span aria-hidden="true">→</span>
      </a>
    </section>
  );
}
