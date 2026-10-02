"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConsumerProgramSummary } from "@mi-pasaporte/domain/server/consumer/programs";
import type { ConsumerCoupon } from "@mi-pasaporte/domain/server/consumer/coupons";
import { PushPrompt } from "../push-prompt";
import { WalletButtons } from "../wallet-cta";
import { ActivityView } from "./activity-view";
import { BenefitsTab } from "./benefits-tab";
import { BottomNav, type WalletTab } from "./bottom-nav";
import { ProgramsTab } from "./programs-tab";
import { QrTab } from "./qr-tab";
import { SettingsTab } from "./settings-tab";
import styles from "./wallet-onboarding.module.css";

type Overlay = "notifications" | "wallet" | null;

function standalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function WalletShell({
  accountId,
  firstName,
  lastName,
  phone,
  programs,
  coupons,
  initialTab,
  qrSvg,
  isIos,
  vapidPublicKey,
  hasWelcomeOffer,
}: {
  accountId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  programs: ConsumerProgramSummary[];
  coupons: ConsumerCoupon[];
  initialTab: WalletTab;
  qrSvg: string;
  isIos: boolean;
  vapidPublicKey: string | null;
  hasWelcomeOffer: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<WalletTab>(initialTab);
  const [showActivity, setShowActivity] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [launchReady, setLaunchReady] = useState(false);
  const [launchError, setLaunchError] = useState(false);
  const [installedMode, setInstalledMode] = useState(false);
  const [welcomeIssued, setWelcomeIssued] = useState(0);
  const initialized = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (overlay) dialogRef.current?.focus();
  }, [overlay]);

  useEffect(() => {
    if (initialized.current || !standalone()) return;
    initialized.current = true;
    setInstalledMode(true);
    const opensKey = `checkpass:home-opens:${accountId}`;
    const walletKey = `checkpass:wallet-prompted:${accountId}`;
    let hiddenAt = 0;

    async function recordLaunch() {
      setLaunchReady(false);
      setLaunchError(false);
      try {
        const response = await fetch("/api/public/home/launch", {
          method: "POST",
        });
        if (!response.ok) throw new Error("launch failed");
        const data = (await response.json()) as { welcomeIssued?: number };
        setWelcomeIssued(data.welcomeIssued ?? 0);
        setLaunchReady(true);
        if (data.welcomeIssued) router.refresh();
      } catch {
        setLaunchError(true);
      }
    }

    function countOpen() {
      const previous = Number(localStorage.getItem(opensKey) ?? "0") || 0;
      const opens = previous + 1;
      localStorage.setItem(opensKey, String(opens));
      if (opens === 1) setOverlay("notifications");
      if (opens >= 2 && !localStorage.getItem(walletKey)) {
        setOverlay("wallet");
      }
      void recordLaunch();
    }

    countOpen();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      if (
        document.visibilityState === "visible" &&
        hiddenAt &&
        Date.now() - hiddenAt > 10_000
      ) {
        hiddenAt = 0;
        countOpen();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [accountId, router]);

  function closeWallet() {
    localStorage.setItem(`checkpass:wallet-prompted:${accountId}`, "1");
    setOverlay(null);
  }

  return (
    <main className="consumer-wallet-shell">
      <header className="cp-app-header">
        <div className="cp-wordmark">
          <span aria-hidden="true">C</span> CheckPass
        </div>
        <button
          className="cp-activity-button"
          type="button"
          aria-label="Ver actividad"
          onClick={() => setShowActivity(true)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3a9 9 0 1 0 9 9M12 7v5l3 2" />
          </svg>
        </button>
      </header>
      {showActivity ? (
        <ActivityView
          coupons={coupons}
          programs={programs}
          onBack={() => setShowActivity(false)}
          onShowBenefits={() => {
            setShowActivity(false);
            setActiveTab("benefits");
          }}
          onShowPrograms={() => {
            setShowActivity(false);
            setActiveTab("programs");
          }}
        />
      ) : (
        <>
          {activeTab === "benefits" && (
            <BenefitsTab
              coupons={coupons}
              onShowQr={() => setActiveTab("qr")}
              onShowPrograms={() => setActiveTab("programs")}
            />
          )}
          {activeTab === "programs" && <ProgramsTab programs={programs} />}
          {activeTab === "qr" && (
            <QrTab
              qrSvg={qrSvg}
              isIos={isIos}
              vapidPublicKey={installedMode ? vapidPublicKey : null}
              onSubscribed={(issued) => {
                setWelcomeIssued(issued);
                setOverlay(null);
                setActiveTab("benefits");
                router.refresh();
              }}
            />
          )}
          {activeTab === "settings" && (
            <SettingsTab
              programs={programs}
              firstName={firstName}
              lastName={lastName}
              phone={phone}
            />
          )}
        </>
      )}
      <BottomNav
        activeTab={activeTab}
        onChange={(tab) => {
          setShowActivity(false);
          setActiveTab(tab);
        }}
      />

      {welcomeIssued > 0 && overlay === null && (
        <div className={styles.toast} role="status">
          ¡Tu beneficio de bienvenida ya está listo! Revisá tus beneficios.
          <button
            type="button"
            onClick={() => setWelcomeIssued(0)}
            aria-label="Cerrar aviso"
          >
            ×
          </button>
        </div>
      )}

      {overlay && (
        <div className={styles.backdrop} role="presentation">
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            ref={dialogRef}
            tabIndex={-1}
          >
            {overlay === "notifications" ? (
              <>
                <span className={styles.step}>PASO 2 DE 2</span>
                <div className={styles.symbol} aria-hidden="true">
                  ♧
                </div>
                <h2 id="onboarding-title">
                  Enterate cuando tengas un beneficio
                </h2>
                <p>
                  Activá las notificaciones para recibir ofertas cercanas y
                  avisos antes de que tus premios venzan.
                </p>
                {hasWelcomeOffer && (
                  <div className={styles.reward}>
                    <strong>Tu bienvenida te espera</strong>
                    <small>
                      Al activar los avisos, recibirás tu beneficio por
                      notificación y podrás verlo aquí, si sigue disponible.
                    </small>
                  </div>
                )}
                {launchError ? (
                  <button
                    className={styles.retry}
                    type="button"
                    onClick={() => window.location.reload()}
                  >
                    Reintentar conexión
                  </button>
                ) : launchReady ? (
                  <PushPrompt
                    vapidPublicKey={vapidPublicKey}
                    embedded
                    onSubscribed={(issued) => {
                      setWelcomeIssued(issued);
                      setOverlay(null);
                      setActiveTab("benefits");
                      router.refresh();
                    }}
                  />
                ) : (
                  <p>Preparando tu cuenta…</p>
                )}
                <button
                  className={styles.later}
                  type="button"
                  onClick={() => setOverlay(null)}
                >
                  Ahora no
                </button>
              </>
            ) : (
              <>
                <span className={styles.step}>TU PASE, SIEMPRE A MANO</span>
                <div className={styles.symbol} aria-hidden="true">
                  ▣
                </div>
                <h2 id="onboarding-title">Guardá tu pase en Wallet</h2>
                <p>
                  Mostrá tu pase en comercios adheridos incluso cuando no tengas
                  conexión.
                </p>
                <WalletButtons isIos={isIos} onAction={closeWallet} />
                <button
                  className={styles.later}
                  type="button"
                  onClick={closeWallet}
                >
                  Más tarde
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
