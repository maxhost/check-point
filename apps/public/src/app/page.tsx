import type { Metadata } from "next";
import { ConsumerHome } from "./consumer-home";
import { siteUrl } from "./site-config";
import "./consumer-home.css";

export const metadata: Metadata = {
  title: "Descubre lugares y beneficios",
  description:
    "Conoce CheckPass: descubre comercios locales, participa en sus programas y encuentra motivos para volver. Empezamos en Cuenca.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_EC",
    url: siteUrl,
    title: "Descubre lugares. Encuentra motivos para volver.",
    description:
      "Conoce cómo funciona CheckPass y explora ejemplos de programas y beneficios.",
    siteName: "CheckPass Club",
  },
  twitter: {
    card: "summary",
    title: "Descubre lugares y beneficios | CheckPass Club",
  },
};

export default function HomePage() {
  return <ConsumerHome />;
}
