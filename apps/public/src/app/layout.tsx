import type { Metadata } from "next";
import { siteUrl } from "./site-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "CheckPass Club", template: "%s | CheckPass Club" },
  description:
    "Descubre CheckPass: conoce comercios locales, participa en sus programas y encuentra motivos para volver.",
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
