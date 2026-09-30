import type { Metadata } from "next";
import { siteUrl } from "./site-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "CheckPass Club", template: "%s | CheckPass Club" },
  description:
    "Crea un programa de fidelización para tu negocio en Cuenca. Premia a tus clientes y dales razones para volver con CheckPass Club.",
  applicationName: "CheckPass Club",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-EC">
      <body>{children}</body>
    </html>
  );
}
