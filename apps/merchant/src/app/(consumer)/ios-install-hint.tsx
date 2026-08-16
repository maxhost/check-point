// Shared iOS "add to home screen" instructions (spec 0037, ADR 0039 §2(1)). Shown on
// the Safari landing after registering (the enroll confirmation, spec 0028) AND on the
// `/wallet` portal when opened in Safari — the two places an iOS user lands before the
// app is installed. Each parent decides WHEN to render it (only when iOS && !standalone),
// so it never appears where the Push API is actually reachable.

"use client";

const card: React.CSSProperties = {
  marginTop: 20,
  padding: 18,
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  background: "#eff6ff",
};

export function IosInstallHint() {
  function openShareSheet() {
    if (navigator.share) {
      void navigator
        .share({ title: "Mi Pasaporte", url: window.location.href })
        .catch(() => {});
    }
  }

  return (
    <section style={card}>
      <h3 style={{ fontSize: 17, margin: 0, color: "#172554" }}>
        Tené Mi Pasaporte siempre a mano
      </h3>
      <p style={{ color: "#1e3a5f", marginTop: 8, fontSize: 14 }}>
        Agregala a la pantalla de inicio para acceder a tu QR y beneficios como
        una app.
      </p>
      {typeof navigator !== "undefined" && "share" in navigator ? (
        <button
          type="button"
          onClick={openShareSheet}
          style={{
            marginTop: 4,
            width: "100%",
            padding: "11px 14px",
            border: "none",
            borderRadius: 9,
            background: "#2563eb",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Abrir Compartir
        </button>
      ) : null}
      <p
        style={{
          color: "#334155",
          marginTop: 12,
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        Si no aparece la opción, tocá los tres puntitos, luego{" "}
        <strong>Compartir</strong>,<strong> Ver más</strong> y{" "}
        <strong>Añadir a la pantalla de inicio</strong>. En inglés:{" "}
        <strong>Share</strong> → <strong>View More</strong> →{" "}
        <strong>Add to Home Screen</strong>.
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
