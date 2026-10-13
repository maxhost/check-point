import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CheckPass Club · Negocios",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      {
        url: "/checkpass-icon-192-v2.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/checkpass-icon-512-v2.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/checkpass-apple-icon-v2.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "CheckPass Negocios",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
