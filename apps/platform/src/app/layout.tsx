import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plataforma · CheckPass Club",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
