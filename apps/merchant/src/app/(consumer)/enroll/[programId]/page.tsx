import { getEnrollLanding } from "../../../../server/consumer/enrollment";
import { EnrollForm } from "./enroll-form";

export const dynamic = "force-dynamic";

export default async function EnrollPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
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
        Mi Pasaporte
      </p>
      <h1 style={{ fontSize: 24, marginTop: 4 }}>{landing.businessName}</h1>
      <p style={{ color: "#555", marginTop: 8, marginBottom: 24 }}>
        Sumate al programa de fidelidad. Solo necesitamos tu nombre y tu
        teléfono.
      </p>
      <EnrollForm
        programId={programId}
        businessName={landing.businessName}
        defaultCountryIso={landing.countryCode ?? "EC"}
      />
    </main>
  );
}
