"use client";

// Web Push opt-in, platform-aware (spec 0037, ADR 0039). Client-only: it touches
// `navigator`/`Notification`, which don't exist on the server.
//
// - iOS in Safari (NOT standalone): the Push API is unavailable — we NEVER call
//   Notification/subscribe here. We only show how to add the app to the home screen, and
//   point at the always-rendered Apple Wallet button as the escape hatch ("solo dame mi
//   pase" — no install needed).
// - iOS installed as a PWA (standalone) OR Android/desktop in the tab: we register the
//   SW and offer the permission prompt on a user gesture, then POST the subscription.
//
// A null `vapidPublicKey` means Web Push is disabled (no VAPID env) → render nothing.

import { useEffect, useState } from "react";
import { readableTextColor } from "../../lib/brand-color";
import { IosInstallHint } from "./ios-install-hint";

// Neutral button color used when no brand accent is passed (e.g. rendered by `/wallet`).
const DEFAULT_BUTTON_BG = "#0f2a3a";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

type Status = "idle" | "subscribed" | "denied" | "error" | "working";

const card: React.CSSProperties = {
  marginTop: 20,
  padding: 16,
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fafafa",
};

export function PushPrompt({
  vapidPublicKey,
  accentColor,
  onSubscribed,
}: {
  vapidPublicKey: string | null;
  /** Optional `#RRGGBB` brand color for the "Activar notificaciones" button (and the
   * install hint when rendered on iOS Safari). Absent → neutral colors (`/wallet`). */
  accentColor?: string;
  onSubscribed?: () => void;
}) {
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const ios = /iphone|ipad|ipod/i.test(ua);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setIsIos(ios);
    setIsStandalone(standalone);
    setPushSupported(supported);

    // On iOS the Push API only works inside the installed PWA; never touch it in Safari.
    if (!supported || (ios && !standalone)) return;
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setStatus("subscribed");
      })
      .catch(() => {});
  }, []);

  if (!vapidPublicKey) return null;

  async function enable() {
    setStatus("working");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
      });
      const json = JSON.parse(JSON.stringify(sub)) as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      const res = await fetch("/api/public/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (res.ok) {
        setStatus("subscribed");
        onSubscribed?.();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  // iOS Safari (not installed): instruct to install; the escape hatch is the Wallet button.
  if (isIos && !isStandalone)
    return <IosInstallHint accentColor={accentColor} />;

  if (!pushSupported) return null;

  return (
    <section style={card}>
      <h3 style={{ fontSize: 15, margin: 0 }}>Avisos de tus beneficios</h3>
      {status === "subscribed" ? (
        <p style={{ color: "#2a7", marginTop: 8, fontSize: 14 }}>
          Notificaciones activadas ✓
        </p>
      ) : (
        <>
          <p style={{ color: "#555", marginTop: 8, fontSize: 14 }}>
            Enterate al instante cuando sumás puntos o sellos.
          </p>
          <button
            type="button"
            onClick={enable}
            disabled={status === "working"}
            style={{
              marginTop: 10,
              padding: "11px 14px",
              width: "100%",
              fontSize: 15,
              borderRadius: 10,
              border: "none",
              background: accentColor ?? DEFAULT_BUTTON_BG,
              color: accentColor ? readableTextColor(accentColor) : "#fff",
              cursor: "pointer",
            }}
          >
            {status === "working" ? "Activando…" : "Activar notificaciones"}
          </button>
          {status === "denied" && (
            <p style={{ color: "#a33", marginTop: 8, fontSize: 13 }}>
              Permiso denegado. Activalo desde los ajustes del navegador.
            </p>
          )}
          {status === "error" && (
            <p style={{ color: "#a33", marginTop: 8, fontSize: 13 }}>
              No pudimos activar las notificaciones. Probá de nuevo.
            </p>
          )}
        </>
      )}
    </section>
  );
}
