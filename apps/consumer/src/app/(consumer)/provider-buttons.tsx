import { readableTextColor } from "@mi-pasaporte/domain/lib/brand-color";

/**
 * Spec 0119 / ADR 0111 §1: «Continuar con Apple» / «Continuar con Google», los dos visibles en
 * todo dispositivo; el del sistema primero (Apple en iOS). Son enlaces al `start` del proveedor:
 * el ingreso entero se resuelve en el servidor. Sin `programId` es login puro (`/wallet`).
 */
export function ProviderButtons({
  programId,
  loc,
  isIos,
  primaryColor,
}: {
  programId?: string | null;
  loc?: string | null;
  isIos: boolean;
  primaryColor: string;
}) {
  const query = new URLSearchParams();
  if (programId) query.set("programId", programId);
  if (loc) query.set("loc", loc);
  const search = query.size ? `?${query.toString()}` : "";
  const providers = [
    { id: "apple", label: "Continuar con Apple" },
    { id: "google", label: "Continuar con Google" },
  ];
  if (!isIos) providers.reverse();
  return (
    <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
      {providers.map((provider, index) => (
        <a
          key={provider.id}
          href={`/api/public/auth/${provider.id}/start${search}`}
          data-provider={provider.id}
          style={{
            display: "block",
            padding: "13px 14px",
            borderRadius: 10,
            fontSize: 16,
            fontWeight: 600,
            textAlign: "center",
            textDecoration: "none",
            border: index === 0 ? "none" : "1px solid #ccc",
            background: index === 0 ? primaryColor : "#fff",
            color: index === 0 ? readableTextColor(primaryColor) : "#222",
          }}
        >
          {provider.label}
        </a>
      ))}
    </div>
  );
}

/** El aviso de `?error=auth`: el ingreso con el proveedor no se completo. */
export function AuthErrorNotice() {
  return (
    <p
      role="alert"
      style={{
        marginTop: 16,
        padding: "10px 12px",
        background: "#fdecea",
        border: "1px solid #f5c6cb",
        borderRadius: 10,
        color: "#a1352c",
        fontSize: 14,
      }}
    >
      No pudimos completar el ingreso. Probá de nuevo.
    </p>
  );
}
