import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import {
  SESSION_COOKIE,
  WALLET_MANIFEST_PATH,
  walletManifestPathFor,
} from "@mi-pasaporte/domain/server/consumer/core";
import { resolveSession } from "@mi-pasaporte/domain/server/consumer/session";
import { renderQrSvg } from "@mi-pasaporte/domain/server/wallet/core";
import { vapidFromEnv } from "@mi-pasaporte/domain/server/push/vapid";
import { listConsumerPrograms } from "@mi-pasaporte/domain/server/consumer/programs";
import { listConsumerCoupons } from "@mi-pasaporte/domain/server/consumer/coupons";
import { getEnrollLanding } from "@mi-pasaporte/domain/server/consumer/enrollment";
import { markAccountOpened } from "@mi-pasaporte/domain/server/wallet/reminder-store";
import { WalletShell } from "./wallet-shell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// PWA hooks (spec 0037/0050): the per-consumer dynamic manifest (start_url carries the
// web_view_token, ADR 0039 §5) + the iOS `apple-mobile-web-app-capable` meta that lets the
// installed icon open standalone (the only iOS context where Web Push works).
//
// The manifest URL carries the token (`?c=`) because the browser fetches
// `<link rel="manifest">` WITHOUT cookies (ADR 0048): this page is the last place that
// still has the session, so it has to hand the token over in the href. Resolving the
// session here duplicates the one in the body on purpose — `cookies()` is deduped by Next
// and `resolveSession` is a single indexed lookup; sharing state across
// `generateMetadata` and the component is not worth the indirection.
export async function generateMetadata(): Promise<Metadata> {
  const store = await cookies();
  const account = await resolveSession(store.get(SESSION_COOKIE)?.value);
  return {
    manifest: account
      ? walletManifestPathFor(account.webViewToken)
      : WALLET_MANIFEST_PATH,
    appleWebApp: {
      capable: true,
      title: "CheckPass",
      statusBarStyle: "default",
    },
  };
}

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
          Check Pass Club
        </p>
        <h1 style={{ fontSize: 22, marginTop: 4 }}>
          Tu tarjeta no está abierta
        </h1>
        <p style={{ color: "#555", marginTop: 12 }}>
          Ingresá con tu número de teléfono para volver a ver tus programas,
          beneficios y tu pase.
        </p>
        <a
          href="/recover"
          style={{
            display: "block",
            marginTop: 24,
            padding: 15,
            borderRadius: 14,
            background: "#176548",
            color: "#fff",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Ingresar con mi teléfono
        </a>
      </main>
    );
  }

  const [qrSvg, ua, programs, coupons] = await Promise.all([
    renderQrSvg(account.qrToken),
    headers().then((h) => h.get("user-agent") ?? ""),
    listConsumerPrograms(account.id),
    listConsumerCoupons(account.id),
    // Spec 0111 D5: opening the account feeds the reminder (never throws, it logs).
    markAccountOpened(account.id),
  ]);
  // Show only the Wallet platform supported by the current device.
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const welcomeLanding = programs[0]
    ? await getEnrollLanding(programs[0].programId)
    : null;

  return (
    <WalletShell
      accountId={account.id}
      firstName={account.firstName}
      lastName={account.lastName}
      phone={account.phoneE164}
      programs={programs}
      coupons={coupons}
      initialTab="benefits"
      qrSvg={qrSvg}
      isIos={isIos}
      vapidPublicKey={vapidFromEnv()?.publicKey ?? null}
      hasWelcomeOffer={welcomeLanding?.welcomeOffer != null}
    />
  );
}
