// Shared iOS "add to home screen" instructions (spec 0037, ADR 0039 §2(1)). Shown on
// the Safari landing after registering (the enroll confirmation, spec 0028) AND on the
// `/wallet` portal when opened in Safari — the two places an iOS user lands before the
// app is installed. Pure/presentational (no hooks): each parent decides WHEN to render it
// (only when iOS && !standalone), so it never appears where the Push API is actually
// reachable. It sells the value of the portal and points at the always-rendered Apple
// Wallet button as the escape hatch ("solo dame mi pase" — no install needed).

const card: React.CSSProperties = {
  marginTop: 20,
  padding: 16,
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fafafa",
};

export function IosInstallHint() {
  return (
    <section style={card}>
      <h3 style={{ fontSize: 15, margin: 0 }}>
        Sumá Mi Pasaporte a tu pantalla de inicio
      </h3>
      <p style={{ color: "#555", marginTop: 8, fontSize: 14 }}>
        Tocá Compartir <span aria-hidden>⎋</span> y elegí{" "}
        <strong>Añadir a inicio</strong> → <strong>Añadir</strong>. Vas a tener
        tus programas, cupones y tu QR a mano — y recibir avisos cuando sumás
        puntos o sellos.
      </p>
      <p style={{ color: "#888", marginTop: 8, fontSize: 13 }}>
        ¿Solo querés el pase? Usá el botón de Apple Wallet de arriba, sin
        instalar nada.
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
