import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "CheckPass Club · Negocios" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
