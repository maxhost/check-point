import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Shop,
  Gift,
  Send,
} from "iconoir-react";
import type { Metadata } from "next";
import { BrandMark } from "../brand-mark";
import { BusinessHeroScene } from "./preview";
import { NeighborhoodScene, RewardScene, ServiceScene } from "./barrio-scenes";
import { BusinessClosingSections, LandingFooter } from "./closing-sections";
import { onboardingUrl, siteUrl } from "../site-config";
import "./business-landing.css";

export const metadata: Metadata = {
  title: "Fidelización, marketing y punto de venta | CheckPass Club",
  description:
    "Invita a nuevos clientes, dales motivos para volver y gestiona tus ventas. Fidelización, marketing y punto de venta para comercios en Cuenca.",
  alternates: { canonical: "/negocios" },
  openGraph: {
    type: "website",
    locale: "es_EC",
    url: `${siteUrl}/negocios`,
    title: "CheckPass Club | Atrae nuevos clientes y dales motivos para volver",
    description:
      "Una red de comercios en Cuenca, fidelización, campañas y POS para tu negocio local.",
    siteName: "CheckPass Club",
  },
  twitter: { card: "summary", title: "CheckPass Club para negocios" },
};

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <span aria-hidden="true">
      {diagonal ? (
        <ArrowUpRight className="landing-icon" />
      ) : (
        <ArrowRight className="landing-icon" />
      )}
    </span>
  );
}

function SignupLink({
  label,
  light = false,
  diagonal = true,
}: {
  label: string;
  light?: boolean;
  diagonal?: boolean;
}) {
  return (
    <a
      className={`button ${light ? "button-light" : "button-dark"}`}
      href={onboardingUrl}
    >
      {label} <Arrow diagonal={diagonal} />
    </a>
  );
}

export default function MerchantLandingPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "CheckPass Club",
        url: siteUrl,
        inLanguage: "es-EC",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "CheckPass Club",
        url: siteUrl,
        description:
          "Red de fidelización, marketing y herramientas de operación para comercios locales.",
        areaServed: {
          "@type": "City",
          name: "Cuenca",
          address: { "@type": "PostalAddress", addressCountry: "EC" },
        },
      },
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/negocios#webpage`,
        url: `${siteUrl}/negocios`,
        name: "Red de fidelización para comercios en Cuenca | CheckPass Club",
        description:
          "Conecta tu negocio con la red de comercios de Cuenca y da a tus clientes más razones para volver.",
        inLanguage: "es-EC",
        about: { "@id": `${siteUrl}/#organization` },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <div className="site-shell business-shell">
        <header className="site-header">
          <a className="brand" href="/" aria-label="CheckPass Club, inicio">
            <BrandMark />
            <span className="brand-name">
              checkpass<span>.</span>club
            </span>
          </a>
          <nav className="desktop-nav" aria-label="Navegación principal">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#planes">Planes</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <a className="header-cta" href={onboardingUrl}>
            Pruébalo gratis 3 meses <Arrow diagonal />
          </a>
        </header>

        <main id="contenido">
          <section className="business-hero" aria-labelledby="hero-title">
            <BusinessHeroScene />
            <div className="business-hero-copy">
              <h1 id="hero-title">
                Dale a tu próximo cliente <em>un motivo para entrar.</em>
              </h1>
              <p className="business-hero-lede">
                Llega a personas que compran cerca. Invítalas a conocer tu
                negocio y dales razones para volver.
              </p>
              <div className="business-hero-actions">
                <SignupLink label="Pruébalo gratis 3 meses" diagonal={false} />
                <a className="business-how-link" href="#como-funciona">
                  Cómo funciona <Arrow />
                </a>
              </div>
              <p className="business-assurance">
                <Check aria-hidden="true" /> Todo incluido durante la prueba.
              </p>
            </div>
          </section>

          <section
            className="barrio-network"
            id="red"
            aria-labelledby="network-title"
          >
            <NeighborhoodScene />
            <div className="barrio-copy">
              <h2 id="network-title">
                Tu próximo cliente <em>compra cerca.</em>
              </h2>
              <p>
                Una persona que compra en otro comercio cercano puede recibir un
                beneficio de tu negocio. Tú eliges qué ofrecer y sus
                condiciones.
              </p>
              <ul className="barrio-benefits">
                {[
                  "Beneficios para conocer tu local",
                  "Campañas con tus condiciones",
                  "Invitaciones automáticas",
                ].map((benefit) => (
                  <li key={benefit}>
                    <Check aria-hidden="true" />
                    {benefit}
                  </li>
                ))}
              </ul>
              <a className="barrio-more" href="/marketing-para-comercios">
                Conoce Venta cruzada <Arrow />
              </a>
            </div>
          </section>

          <section
            className="barrio-loyalty"
            id="programa"
            aria-labelledby="loyalty-title"
          >
            <RewardScene />
            <div className="barrio-copy">
              <h2 id="loyalty-title">
                Dales razones <em>para volver.</em>
              </h2>
              <p>
                Tus clientes se unen con el QR. Acumulan puntos o sellos con las
                compras o acciones de tu programa y canjean el premio cuando
                cumplen sus condiciones.
              </p>
              <a className="barrio-more" href="/programa-de-fidelizacion">
                Descubre el programa de recompensas para tu negocio <Arrow />
              </a>
            </div>
          </section>

          <section
            className="barrio-service"
            id="beneficios"
            aria-labelledby="pos-title"
          >
            <ServiceScene />
            <div className="barrio-copy">
              <h2 id="pos-title">
                Atiende, cobra
                <br />y recompensa.
              </h2>
              <p>
                Toma pedidos y cobra desde tu teléfono. Identifica al cliente
                con su pase y suma o canjea sus recompensas al atenderlo.
              </p>
              <a className="barrio-more" href="/punto-de-venta">
                Conoce el punto de venta <Arrow />
              </a>
            </div>
          </section>

          <section
            className="barrio-start"
            id="como-funciona"
            aria-labelledby="start-title"
          >
            <div>
              <h2 id="start-title">
                Empieza con tu <em>primer cliente.</em>
              </h2>
              <p>Configura tu negocio y empieza a invitar a nuevos clientes.</p>
            </div>
            <ol className="barrio-steps">
              {[
                {
                  title: "Prepara tu local",
                  text: "Completa los datos de tu negocio.",
                  Icon: Shop,
                },
                {
                  title: "Activa tu programa",
                  text: "Elige puntos o sellos y el premio.",
                  Icon: Gift,
                },
                {
                  title: "Invita a tu primer cliente",
                  text: "Comparte el QR de tu local.",
                  Icon: Send,
                },
              ].map(({ title, text, Icon }, index) => (
                <li key={title}>
                  <span className="barrio-step-number">{index + 1}</span>
                  <Icon className="barrio-step-icon" aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{text}</p>
                  {index < 2 && (
                    <ArrowRight
                      className="barrio-step-arrow"
                      aria-hidden="true"
                    />
                  )}
                </li>
              ))}
            </ol>
          </section>
          <BusinessClosingSections />
        </main>

        <LandingFooter showPhotoCredit={false} compact />
      </div>
    </>
  );
}
