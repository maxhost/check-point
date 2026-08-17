import { cookies, headers } from "next/headers";
import { SESSION_COOKIE } from "../../../server/consumer/core";
import { resolveSession } from "../../../server/consumer/session";
import { renderQrSvg } from "../../../server/wallet/core";
import { vapidFromEnv } from "../../../server/push/vapid";
import { listConsumerPrograms } from "../../../server/consumer/programs";
import { hasWebPushSubscription } from "../../../server/push/subscriptions";
import { WalletShell } from "./wallet-shell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// PWA hooks (spec 0037): the per-consumer dynamic manifest (start_url carries the
// web_view_token, ADR 0039) + the iOS `apple-mobile-web-app-capable` meta that lets the
// installed icon open standalone (the only iOS context where Web Push works).
export const metadata = {
  manifest: "/wallet/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CheckPass Club",
    statusBarStyle: "default",
  },
} as const;

const page: React.CSSProperties = {
  maxWidth: 420,
  margin: "0 auto",
  padding: "32px 20px",
  fontFamily: "system-ui, sans-serif",
};

export default async function WalletPage() {
  const store = await cookies();
  const account = await resolveSession(store.get(SESSION_COOKIE)?.value);

  if (!account) {
    return (
      <main style={{ ...page, textAlign: "center" }}>
        <p style={{ color: "#888", fontSize: 13, letterSpacing: 0.4 }}>
          CheckPass Club
        </p>
        <h1 style={{ fontSize: 22, marginTop: 4 }}>
          Tu tarjeta no está abierta
        </h1>
        <p style={{ color: "#555", marginTop: 12 }}>
          Sumate a un programa desde el enlace de un local para ver tu tarjeta y
          tu código QR.
        </p>
      </main>
    );
  }

  const [qrSvg, ua, programs, hasSubscription] = await Promise.all([
    renderQrSvg(account.qrToken),
    headers().then((h) => h.get("user-agent") ?? ""),
    listConsumerPrograms(account.id),
    hasWebPushSubscription(account.id),
  ]);
  // Show only the Wallet platform supported by the current device.
  const isIos = /iphone|ipad|ipod/i.test(ua);

  return (
    <WalletShell
      firstName={account.firstName}
      programs={programs}
      initialTab={hasSubscription ? "programs" : "qr"}
      qrSvg={qrSvg}
      isIos={isIos}
      vapidPublicKey={vapidFromEnv()?.publicKey ?? null}
    />
  );
}
