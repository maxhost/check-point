import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "CheckPass Club · Demo",
  description: "Prototipo de check-in de CheckPass Club",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
