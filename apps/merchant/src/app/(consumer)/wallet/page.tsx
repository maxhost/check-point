import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../server/db";
import {
  businesses,
  loyaltyPrograms,
  programMemberships,
} from "../../../server/schema";
import { SESSION_COOKIE } from "../../../server/consumer/core";
import { resolveSession } from "../../../server/consumer/session";
import { renderQrSvg } from "../../../server/wallet/core";
import { WalletButtons } from "../wallet-cta";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
          Mi Pasaporte
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

  const [qrSvg, ua] = await Promise.all([
    renderQrSvg(account.qrToken),
    headers().then((h) => h.get("user-agent") ?? ""),
  ]);
  // Detection reorders the buttons; both are ALWAYS shown (fallback), never hidden.
  const isIos = /iphone|ipad|ipod/i.test(ua);

  const memberships = await getDb()
    .select({
      membershipId: programMemberships.id,
      programId: programMemberships.programId,
      businessName: businesses.name,
    })
    .from(programMemberships)
    .innerJoin(
      loyaltyPrograms,
      eq(loyaltyPrograms.id, programMemberships.programId),
    )
    .innerJoin(businesses, eq(businesses.id, loyaltyPrograms.businessId))
    .where(eq(programMemberships.consumerId, account.id));

  return (
    <main style={page}>
      <p style={{ color: "#888", fontSize: 13, letterSpacing: 0.4 }}>
        Mi Pasaporte
      </p>
      <h1 style={{ fontSize: 24, marginTop: 4 }}>
        ¡Hola, {account.firstName}!
      </h1>
      <p style={{ color: "#555", marginTop: 8 }}>
        Mostrá este código en el local para sumar tus beneficios.
      </p>

      <div
        aria-label="Tu código QR"
        style={{
          marginTop: 20,
          padding: 16,
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 16,
          width: 240,
          maxWidth: "100%",
          marginLeft: "auto",
          marginRight: "auto",
        }}
        // Server-rendered SVG string from the qrToken (never exposed as text).
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />

      <div style={{ marginTop: 24 }}>
        <WalletButtons isIos={isIos} />
      </div>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18 }}>Tus programas</h2>
        {memberships.length === 0 ? (
          <p style={{ color: "#777", marginTop: 8 }}>
            Todavía no tenés programas.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
            {memberships.map((m) => (
              <li
                key={m.membershipId}
                style={{
                  padding: "12px 14px",
                  border: "1px solid #eee",
                  borderRadius: 10,
                  marginTop: 8,
                }}
              >
                {m.businessName}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
