import { cookies, headers } from "next/headers";
import {
  getEnrollLanding,
  isProgramMember,
} from "@mi-pasaporte/domain/server/consumer/enrollment";
import { SESSION_COOKIE } from "@mi-pasaporte/domain/server/consumer/core";
import { resolveSession } from "@mi-pasaporte/domain/server/consumer/session";
import { AuthErrorNotice, ProviderButtons } from "../../provider-buttons";
import { MemberNotMe, OneTapEnroll } from "./enroll-buttons";
import { WelcomeOffer } from "./welcome-offer";
import {
  BusinessIdentity,
  EntryBrand,
  EnrollmentIntro,
} from "../../entry-brand";
import styles from "../../consumer-entry.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : (value ?? null);

/**
 * La landing del QR de un comercio (spec 0119 / ADR 0111). Sin sesion: los dos botones de
 * proveedor (tocar uno es el consentimiento de sumarse a ESTE programa). Con sesion: «Ya sos
 * parte» si ya es miembro, si no el alta de un toque. Spec0208: identidad real del comercio
 * y marco Club cotidiano/paletaA; la oferta de bienvenida conserva su condición de existencia.
 */
export default async function EnrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{
    loc?: string | string[];
    error?: string | string[];
  }>;
}) {
  const { programId } = await params;
  const query = await searchParams;
  // `loc` (ADR 0042): the origin local encoded by the brand-kit poster QR.
  const loc = first(query.loc);
  const landing = await getEnrollLanding(programId);

  if (!landing) {
    return (
      <main className={`${styles.page} ${styles.unavailable}`}>
        <div className={styles.content}>
          <EntryBrand large />
          <div className={styles.intro}>
            <h1>Este programa no está disponible</h1>
            <p>
              El enlace puede haber vencido o el programa ya no admite nuevos
              registros. Pide al local un código actualizado.
            </p>
          </div>
          <a className={styles.passLink} href="/wallet">
            Ir a mi wallet
          </a>
        </div>
      </main>
    );
  }

  const [store, requestHeaders] = await Promise.all([cookies(), headers()]);
  const account = await resolveSession(store.get(SESSION_COOKIE)?.value);
  const member = account ? await isProgramMember(account.id, programId) : false;
  const isIos = /iphone|ipad|ipod/i.test(
    requestHeaders.get("user-agent") ?? "",
  );

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <BusinessIdentity
          businessName={landing.businessName}
          logoUrl={
            landing.hasLogo
              ? `/api/public/brands/${landing.businessId}/logo?v=${landing.logoVersion}`
              : undefined
          }
        />
        {first(query.error) === "auth" && <AuthErrorNotice />}
        {member && account ? (
          <MemberNotMe
            programId={programId}
            loc={loc}
            businessName={landing.businessName}
            firstName={account.firstName}
            isIos={isIos}
          />
        ) : account ? (
          <OneTapEnroll
            programId={programId}
            loc={loc}
            firstName={account.firstName}
            businessName={landing.businessName}
            welcomeOffer={landing.welcomeOffer}
            isIos={isIos}
          />
        ) : (
          <>
            <EnrollmentIntro businessName={landing.businessName} />
            {landing.welcomeOffer && (
              <WelcomeOffer offer={landing.welcomeOffer} />
            )}
            <ProviderButtons programId={programId} loc={loc} isIos={isIos} />
            <p className={styles.supportNote}>
              Al continuar, te unes al programa de este comercio con tu cuenta
              de CheckPass.
            </p>
          </>
        )}
        <EntryBrand />
      </div>
    </main>
  );
}
