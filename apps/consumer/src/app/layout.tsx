import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Check Pass Club",
  icons: {
    icon: [
      { url: "/checkpass-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/checkpass-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/checkpass-apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "CheckPass",
    statusBarStyle: "default",
  },
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
