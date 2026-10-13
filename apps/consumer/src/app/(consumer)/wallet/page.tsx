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
import { listConsumerNotices } from "@mi-pasaporte/domain/server/consumer/notices";
import { getEnrollLanding } from "@mi-pasaporte/domain/server/consumer/enrollment";
import { markAccountOpened } from "@mi-pasaporte/domain/server/wallet/reminder-store";
import { AuthErrorNotice, ProviderButtons } from "../provider-buttons";
import { WalletShell } from "./wallet-shell";
import { EntryBrand } from "../entry-brand";
import styles from "../consumer-entry.module.css";

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

export default async function WalletPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string | string[] }>;
}) {
  const store = await cookies();
  const account = await resolveSession(store.get(SESSION_COOKIE)?.value);
  const ua = (await headers()).get("user-agent") ?? "";
  // Show only the Wallet platform supported by the current device.
  const isIos = /iphone|ipad|ipod/i.test(ua);

  if (!account) {
    // Spec 0119 / ADR 0111 §8: entrar sin programa — los mismos dos botones, login puro.
    const error = (await searchParams)?.error;
    return (
      <main className={styles.page}>
        <div className={styles.content}>
          <EntryBrand large />
          <div className={`${styles.intro} ${styles.accessIntro}`}>
            <h1>
              Hola
              <br />
              de nuevo
            </h1>
            <p>
              Iniciar sesión en la wallet para acceder al pase y los beneficios.
            </p>
          </div>
          {(Array.isArray(error) ? error[0] : error) === "auth" && (
            <AuthErrorNotice />
          )}
          <ProviderButtons isIos={isIos} />
          <p className={styles.supportNote}>
            Con la misma cuenta usada para unirse a los programas.
          </p>
        </div>
      </main>
    );
  }

  const [qrSvg, programs, coupons, notices] = await Promise.all([
    renderQrSvg(account.qrToken),
    listConsumerPrograms(account.id),
    listConsumerCoupons(account.id).then((list) => list.coupons),
    listConsumerNotices(account.id),
    // Spec 0111 D5: opening the account feeds the reminder (never throws, it logs).
    markAccountOpened(account.id),
  ]);
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
      notices={notices}
      initialTab="benefits"
      qrSvg={qrSvg}
      isIos={isIos}
      vapidPublicKey={vapidFromEnv()?.publicKey ?? null}
      hasWelcomeOffer={welcomeLanding?.welcomeOffer != null}
    />
  );
}
