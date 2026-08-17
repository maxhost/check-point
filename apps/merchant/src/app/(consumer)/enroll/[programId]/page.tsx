import { getEnrollLanding } from "../../../../server/consumer/enrollment";
import { vapidFromEnv } from "../../../../server/push/vapid";
import { EnrollForm } from "./enroll-form";

export const dynamic = "force-dynamic";

export default async function EnrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ loc?: string | string[] }>;
}) {
  const { programId } = await params;
  // `loc` (ADR 0042): the origin local encoded by the brand-kit poster QR. Carried
  // into the form so it travels in the POST body; validated server-side at enroll.
  const rawLoc = (await searchParams).loc;
  const loc = Array.isArray(rawLoc) ? rawLoc[0] : (rawLoc ?? null);
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
      <EnrollForm
        programId={programId}
        loc={loc}
        businessName={landing.businessName}
        defaultCountryIso={landing.countryCode ?? "EC"}
        brandPrimaryColor={landing.brandPrimaryColor}
        vapidPublicKey={vapidFromEnv()?.publicKey ?? null}
      />
    </main>
  );
}
