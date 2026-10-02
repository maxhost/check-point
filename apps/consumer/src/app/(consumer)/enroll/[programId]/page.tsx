import { cookies, headers } from "next/headers";
import { readableTextColor } from "@mi-pasaporte/domain/lib/brand-color";
import {
  getEnrollLanding,
  isProgramMember,
} from "@mi-pasaporte/domain/server/consumer/enrollment";
import { SESSION_COOKIE } from "@mi-pasaporte/domain/server/consumer/core";
import { resolveSession } from "@mi-pasaporte/domain/server/consumer/session";
import { AuthErrorNotice, ProviderButtons } from "../../provider-buttons";
import { OneTapEnroll } from "./enroll-buttons";
import { WelcomeOffer } from "./welcome-offer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : (value ?? null);

/**
 * La landing del QR de un comercio (spec 0119 / ADR 0111). Sin sesion: los dos botones de
 * proveedor (tocar uno es el consentimiento de sumarse a ESTE programa). Con sesion: «Ya sos
 * parte» si ya es miembro, si no el alta de un toque. El marco es el de siempre: logo o nombre
 * del negocio, su color en el boton primario y la oferta de bienvenida.
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
      <main
        style={{
          maxWidth: 420,
          margin: "0 auto",
          padding: "48px 20px",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 22 }}>Este programa no está disponible</h1>
        <p style={{ color: "#555", marginTop: 12 }}>
          El enlace puede haber vencido o el programa ya no admite nuevos
          registros. Pedile al local un código actualizado.
        </p>
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
    <main
      style={{
        maxWidth: 420,
        margin: "0 auto",
        padding: "32px 20px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <p style={{ color: "#888", fontSize: 13, letterSpacing: 0.4 }}>
        CheckPass Club
      </p>
      {landing.hasLogo ? (
        // Public logo route serves from R2 without exposing the object key.
        <img
          alt={landing.businessName}
          src={`/api/public/brands/${landing.businessId}/logo?v=${landing.logoVersion}`}
          style={{
            display: "block",
            height: 64,
            maxWidth: "100%",
            objectFit: "contain",
            marginTop: 8,
          }}
        />
      ) : (
        <h1 style={{ fontSize: 24, marginTop: 4 }}>{landing.businessName}</h1>
      )}
      {member ? (
        <section>
          <h2 style={{ fontSize: 20, marginTop: 20 }}>
            Ya sos parte de {landing.businessName}
          </h2>
          <a
            href="/wallet"
            style={{
              display: "block",
              marginTop: 20,
              padding: "13px 14px",
              borderRadius: 10,
              textAlign: "center",
              textDecoration: "none",
              fontWeight: 600,
              background: landing.brandPrimaryColor,
              color: readableTextColor(landing.brandPrimaryColor),
            }}
          >
            Ver mi tarjeta
          </a>
        </section>
      ) : (
        <section>
          {landing.welcomeOffer && (
            <WelcomeOffer offer={landing.welcomeOffer} />
          )}
          <p style={{ color: "#555", marginTop: 8 }}>
            Sumate al programa de fidelidad de {landing.businessName}.
          </p>
          {first(query.error) === "auth" && <AuthErrorNotice />}
          {account ? (
            <OneTapEnroll
              programId={programId}
              loc={loc}
              firstName={account.firstName}
              primaryColor={landing.brandPrimaryColor}
              isIos={isIos}
            />
          ) : (
            <ProviderButtons
              programId={programId}
              loc={loc}
              isIos={isIos}
              primaryColor={landing.brandPrimaryColor}
            />
          )}
        </section>
      )}
    </main>
  );
}
