"use client";

import { useEffect } from "react";
import { WalletButtons } from "../../wallet-cta";
import { IosInstallHint, isIosSafariBrowser } from "../../ios-install-hint";
import { PushPrompt } from "../../push-prompt";

/**
 * Post-enroll confirmation (spec 0051 / ADR 0049): ONE screen with the felicitación,
 * the "add to home screen" instructions and the Apple Wallet button. The icon installed
 * from here must open the consumer's wallet, so the manifest handed over by the 201
 * (`walletManifestPath`, `start_url = /c/<token>`) is injected below.
 */
export function EnrollConfirmation({
  firstName,
  businessName,
  brandPrimaryColor,
  vapidPublicKey,
  walletManifestPath,
}: {
  firstName: string;
  businessName: string;
  brandPrimaryColor: string;
  vapidPublicKey: string | null;
  /** Per-consumer manifest path from the enroll 201; null when the response lacked it. */
  walletManifestPath: string | null;
}) {
  // ADR 0049: inject `<link rel="manifest">` only while the confirmation is mounted.
  // Before the 201 the page has NO manifest on purpose — an icon added from the form
  // has no wallet to open (the original spec-0050 bug). If the response did not carry
  // the path (older server, odd failure) we inject nothing and the rest still works.
  useEffect(() => {
    if (!walletManifestPath) return;
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = walletManifestPath;
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [walletManifestPath]);

  // Client-side detection selects the Wallet platform available on this device.
  const isIos =
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <section>
      <h2 style={{ fontSize: 20 }}>¡Listo, {firstName}! 🎉</h2>
      <p style={{ color: "#333", marginTop: 8 }}>
        Ya sos parte del programa de <strong>{businessName}</strong>.
      </p>
      {/* Opt-in by platform (spec 0038 / ADR 0040), restored by ADR 0049. iOS Safari
          gets the "add to home screen" hint DIRECTLY — decoupled from Web Push being
          configured, it stands for the portal/pass even when `vapidPublicKey` is null.
          Android/desktop get the Web Push permission button; `PushPrompt` renders
          nothing when Web Push is disabled (`vapidPublicKey === null`). */}
      {isIosSafariBrowser() ? (
        <IosInstallHint accentColor={brandPrimaryColor} />
      ) : (
        <PushPrompt
          vapidPublicKey={vapidPublicKey}
          accentColor={brandPrimaryColor}
        />
      )}
      {/* Session cookie is already set by the POST — the buttons hit the
          session-authorized endpoint directly, no extra navigation. */}
      <div style={{ marginTop: 20 }}>
        <WalletButtons isIos={isIos} />
      </div>
      {/* Secondary action: the protagonist of this screen is install + Apple Wallet. */}
      <a
        href="/wallet"
        style={{
          display: "block",
          textAlign: "center",
          marginTop: 16,
          fontSize: 14,
          color: "#2563eb",
          textDecoration: "underline",
        }}
      >
        Ver mi tarjeta y código QR
      </a>
    </section>
  );
}
