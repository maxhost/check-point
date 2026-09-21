import type { Metadata } from "next";
import "driver.js/dist/driver.css";
import "./globals.css";

export const metadata: Metadata = { title: "CheckPass Club · Negocios" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
