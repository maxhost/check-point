import type { MetadataRoute } from "next";

/**
 * El panel se instala como PWA (PARQUEADO #86, owner 2026-10-09: «la idea es que pueda
 * instalarlo como PWA y abra el POS»). Spec 0220 / ADR 0141 §2: abre en `/backoffice/start`, la
 * pagina del core que resuelve la pagina de inicio del primer modulo encendido que el usuario puede
 * usar (o el panel), y la app se llama «CheckPass Negocios» (owner 2026-10-13). `scope: "/"` deja el
 * resto del panel dentro de la app instalada. Sin sesion, `/backoffice/start` manda al login como
 * cualquier pagina del panel.
 *
 * EXCEPCION NOMBRADA (ADR 0141 §2): `id` queda CONGELADO en su valor historico. Cambiarlo hace que
 * los navegadores traten la app instalada como otra app; es un identificador opaco, no una ruta que
 * el core use (`modules-boundary-literals.test.ts` lo lista).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CheckPass Negocios",
    short_name: "CheckPass Negocios",
    description: "El punto de venta de tu negocio en CheckPass Club.",
    id: "/backoffice/pos",
    start_url: "/backoffice/start",
    scope: "/",
    display: "standalone",
    background_color: "#0f2a3a",
    theme_color: "#0f2a3a",
    icons: [
      {
        src: "/checkpass-icon-192-v2.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/checkpass-icon-512-v2.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/checkpass-icon-maskable-512-v2.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
