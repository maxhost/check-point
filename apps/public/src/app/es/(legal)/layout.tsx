import type { ReactNode } from "react";
import { BrandMark } from "../../brand-mark";
import "./legal.css";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="legal-page">
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      <header className="legal-header">
        <a className="brand" href="/" aria-label="CheckPass Club, inicio">
          <BrandMark />
          <span>checkpass.club</span>
        </a>
        <nav aria-label="Navegación principal">
          <a href="/">Para negocios</a>
          <a href="/explorar">Explorar</a>
        </nav>
      </header>
      {children}
      <footer className="legal-footer">
        <span>© {new Date().getFullYear()} CheckPass Club</span>
        <nav aria-label="Documentos legales">
          <a href="/es/privacy">Privacidad</a>
          <a href="/es/tos">Términos de uso</a>
        </nav>
      </footer>
    </div>
  );
}
