// Shared iOS "add to home screen" instructions (spec 0037, ADR 0039 §2(1)). Shown on
// the Safari landing after registering (the enroll confirmation, spec 0028) AND on the
// `/wallet` portal when opened in Safari — the two places an iOS user lands before the
// app is installed. Each parent decides WHEN to render it (only when iOS && !standalone),
// so it never appears where the Push API is actually reachable.
//
// No "share" button here on purpose: iOS exposes NO API to add to the home screen, and
// `navigator.share()` opens the *content* share sheet (send-a-link), which never contains
// "Add to Home Screen" — that action lives only in Safari's own toolbar share menu. So we
// point the user straight at the real Safari icon and walk the steps.

"use client";

const card: React.CSSProperties = {
  marginTop: 20,
  padding: 18,
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  background: "#eff6ff",
};

// Safari's "Share" glyph (rounded square with an up-arrow) — the icon the user must tap.
function ShareGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2563eb"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ verticalAlign: "-4px" }}
    >
      <path d="M12 3v11" />
      <path d="M8 6l4-4 4 4" />
      <path d="M6 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}

// "Add to Home Screen" glyph (rounded square with a plus).
function AddGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2563eb"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ verticalAlign: "-4px" }}
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

const stepRow: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  marginTop: 14,
};
const stepNum: React.CSSProperties = {
  flex: "0 0 auto",
  width: 24,
  height: 24,
  borderRadius: "50%",
  background: "#2563eb",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};
const stepText: React.CSSProperties = {
  color: "#1e3a5f",
  fontSize: 14,
  lineHeight: 1.5,
  margin: 0,
};

export function IosInstallHint() {
  return (
    <section style={card}>
      <h3 style={{ fontSize: 17, margin: 0, color: "#172554" }}>
        Instalá tu pasaporte en la pantalla de inicio
      </h3>
      <p
        style={{
          color: "#1e3a5f",
          marginTop: 8,
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        Con un toque abrís tu tarjeta y tu código QR, sin buscar el link ni
        volver a registrarte. Además te avisamos al instante cuando sumás puntos
        o sellos y tenés un beneficio esperándote.
      </p>

      <div style={{ marginTop: 6 }}>
        <div style={stepRow}>
          <span style={stepNum}>1</span>
          <p style={stepText}>
            Tocá el ícono <ShareGlyph /> <strong>Compartir</strong> en la barra
            de Safari (abajo, o arriba a la derecha).
          </p>
        </div>
        <div style={stepRow}>
          <span style={stepNum}>2</span>
          <p style={stepText}>
            Deslizá hacia abajo y tocá <AddGlyph />{" "}
            <strong>Añadir a pantalla de inicio</strong>.
          </p>
        </div>
        <div style={stepRow}>
          <span style={stepNum}>3</span>
          <p style={stepText}>
            Tocá <strong>Añadir</strong>. Listo: ya tenés el ícono de Mi
            Pasaporte en tu teléfono.
          </p>
        </div>
      </div>

      <p
        style={{
          color: "#475569",
          marginTop: 14,
          fontSize: 12.5,
          lineHeight: 1.45,
        }}
      >
        En inglés los pasos son <strong>Share</strong> →{" "}
        <strong>Add to Home Screen</strong> → <strong>Add</strong>.
      </p>
    </section>
  );
}

/** True when running on iOS Safari (not the installed standalone PWA) — the only place
 * the install hint belongs. Client-only: touches `navigator`/`window`. Safe to call at
 * render time in a client component (these screens never render during SSR). */
export function isIosSafariBrowser(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined")
    return false;
  const ua = navigator.userAgent || "";
  const ios = /iphone|ipad|ipod/i.test(ua);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}
