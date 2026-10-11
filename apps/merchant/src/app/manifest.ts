import type { MetadataRoute } from "next";

/**
 * El panel se instala como PWA y abre en el POS (PARQUEADO #86, owner 2026-10-09: «la idea es
 * que pueda instalarlo como PWA y abra el POS»). `scope: "/"` deja el resto del panel dentro de
 * la app instalada. Sin sesion, `/backoffice/pos` manda al login como cualquier pagina del panel.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CheckPass POS",
    short_name: "CheckPass POS",
    description: "El punto de venta de tu negocio en CheckPass Club.",
    id: "/backoffice/pos",
    start_url: "/backoffice/pos",
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
