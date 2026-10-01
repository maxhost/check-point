import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { mockBusinesses } from "../../explore/mock-businesses";
import { consumerWalletUrl } from "../../site-config";
import "../../explore/explore.css";

type Props = { params: Promise<{ slug: string }> };

function IllustrativeMap({ area }: { area: string }) {
  return (
    <div
      className="explore-detail-map"
      role="img"
      aria-label={`Mapa ilustrativo de la zona ${area} en Cuenca, sin ubicación exacta`}
    >
      <svg
        viewBox="0 0 1200 420"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <rect width="1200" height="420" fill="#e8eee6" />
        <path
          d="M-40 345C170 295 220 405 410 353S730 304 916 361s250 8 350-26"
          fill="none"
          stroke="#d1e7e8"
          strokeWidth="72"
        />
        <path
          d="M-40 345C170 295 220 405 410 353S730 304 916 361s250 8 350-26"
          fill="none"
          stroke="#a9d3d8"
          strokeWidth="39"
        />
        <path
          d="M85-30 176 450M305-30 397 450M545-30 595 450M785-30 820 450M1025-30 1058 450M-20 70 1220 25M-20 180 1220 128M-20 287 1220 245"
          fill="none"
          stroke="#fffdf7"
          strokeWidth="25"
          strokeLinecap="round"
        />
        <path
          d="m31 113 104-4 14 85-106 5zm424 95 83-3 8 61-86 4zm460-130 81-3 6 62-84 4z"
          fill="#d5e4cd"
        />
        <path
          d="M-20 70 1220 25M-20 180 1220 128M-20 287 1220 245"
          fill="none"
          stroke="#d7ddd2"
          strokeWidth="2"
        />
        <text
          x="70"
          y="275"
          fill="#8a9a8e"
          fontSize="24"
          fontWeight="700"
          letterSpacing="6"
        >
          CUENCA
        </text>
      </svg>
      <div className="explore-detail-map-pin" aria-hidden="true">
        <span />
      </div>
      <div className="explore-detail-map-label">
        <strong>{area}</strong>
        <span>Zona aproximada · Cuenca</span>
      </div>
    </div>
  );
}

export const dynamicParams = false;

export function generateStaticParams() {
  return mockBusinesses.map(({ id }) => ({ slug: id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = mockBusinesses.find((item) => item.id === slug);
  if (!business)
    return { title: "Lugar no encontrado", robots: { index: false } };
  return {
    title: `${business.name} · Ficha de ejemplo`,
    description: `Ficha de ejemplo de ${business.name} en Cuenca. Los datos son ilustrativos y no representan un comercio participante.`,
    robots: { index: false, follow: false },
  };
}

export default async function MockBusinessPage({ params }: Props) {
  const { slug } = await params;
  const business = mockBusinesses.find((item) => item.id === slug);
  if (!business) notFound();

  return (
    <div className="explore-page explore-detail-page">
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      <header className="explore-header">
        <Link className="brand" href="/" aria-label="CheckPass Club, inicio">
          <span className="brand-symbol">
            c<span>.</span>
          </span>
          <span className="brand-name">
            checkpass<span>.</span>club
          </span>
        </Link>
        <nav aria-label="Navegación principal">
          <Link href="/#explorar">Explorar</Link>
          <Link href="/">Para negocios</Link>
        </nav>
        <a className="explore-login" href={consumerWalletUrl}>
          Mi pase <span aria-hidden="true">↗</span>
        </a>
      </header>
      <main id="contenido" className="explore-detail">
        <Link className="explore-detail-back" href="/#explorar">
          ← Volver a explorar
        </Link>
        <div className="explore-detail-heading">
          <div>
            <span className="explore-eyebrow">
              {business.category.toUpperCase()} · CUENCA
            </span>
            <h1>{business.name}</h1>
            <p>
              {business.area}, Cuenca <span aria-hidden="true">·</span> Horario
              de ejemplo: {business.hours.opens}–{business.hours.closes}
            </p>
          </div>
          <span className="explore-detail-example">LUGAR DE EJEMPLO</span>
        </div>
        <figure className="explore-detail-photo">
          <Image
            src={business.image}
            alt={business.imageAlt}
            width={1000}
            height={667}
            sizes="(max-width: 800px) 100vw, 90vw"
            priority
            style={{ objectPosition: business.imagePosition }}
          />
          <figcaption>
            Fotografía de referencia · El lugar mostrado es ficticio
          </figcaption>
        </figure>
        <div className="explore-detail-content">
          <div className="explore-detail-story">
            <span className="explore-eyebrow">EL LUGAR</span>
            <h2>Un buen plan para volver.</h2>
            <p>{business.description}</p>
            <div className="explore-detail-facts">
              <div>
                <span aria-hidden="true">⌖</span>
                <div>
                  <strong>En {business.area}</strong>
                  <p>Cuenca, Ecuador</p>
                </div>
              </div>
              <div>
                <span aria-hidden="true">◷</span>
                <div>
                  <strong>Horario diario de ejemplo</strong>
                  <p>
                    {business.hours.opens}–{business.hours.closes}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <aside
            className="explore-detail-benefit"
            aria-label="Beneficio de ejemplo"
          >
            <span className="explore-eyebrow">EN CHECKPASS CLUB</span>
            <h2>Cada visita puede sumar.</h2>
            <p>{business.benefit}</p>
            <div className="explore-detail-benefit-note">
              <strong>¿Cómo funciona?</strong>
              <span>
                En un negocio participante, escanea el QR del local para conocer
                las condiciones reales y guardar tu pase.
              </span>
            </div>
            <span className="explore-detail-benefit-foot">
              Beneficio ilustrativo · No es una oferta vigente
            </span>
          </aside>
        </div>
        <section
          className="explore-detail-location"
          aria-labelledby="location-title"
        >
          <div className="explore-detail-section-heading">
            <div>
              <span className="explore-eyebrow">UBICACIÓN</span>
              <h2 id="location-title">Por {business.area}, Cuenca.</h2>
            </div>
            <p>
              Una referencia de la zona para imaginar tu próxima visita. La
              dirección exacta llegará con la ficha real del comercio.
            </p>
          </div>
          <IllustrativeMap area={business.area} />
          <p className="explore-detail-map-disclaimer">
            Mapa ilustrativo; el marcador no señala una dirección real.
          </p>
        </section>
        <div className="explore-detail-end">
          <p>
            Este lugar, sus horarios y beneficios son ejemplos para explorar el
            diseño.
          </p>
          <Link className="explore-primary" href="/#explorar">
            Seguir explorando <span aria-hidden="true">→</span>
          </Link>
        </div>
      </main>
      <footer className="explore-footer">
        <div>
          <Link className="brand" href="/">
            <span className="brand-symbol">
              c<span>.</span>
            </span>
            <span className="brand-name">
              checkpass<span>.</span>club
            </span>
          </Link>
          <p>Más motivos para volver. Empezamos en Cuenca.</p>
        </div>
        <nav aria-label="Navegación del pie de página">
          <Link href="/#explorar">Explorar</Link>
          <Link href="/">Para negocios</Link>
        </nav>
      </footer>
    </div>
  );
}
