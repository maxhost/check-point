import { ArrowRight, ArrowUpRight, Check, Shop, Star } from "iconoir-react";
import type { Metadata } from "next";
import { BrandMark } from "../brand-mark";
import {
  DashboardPreview,
  BusinessHeroScene,
  LoyaltyJourney,
  NetworkPreview,
} from "./preview";
import { ClosingSections, LandingFooter } from "./closing-sections";
import { onboardingUrl, siteUrl } from "../site-config";
import "./negocios.css";
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

          <section className="business-next" aria-labelledby="next-title">
            <div className="business-next-copy">
              <h2 id="next-title">
                La primera visita <em>es solo el comienzo.</em>
              </h2>
              <p>
                Con CheckPass, puedes invitar nuevos clientes y premiar su
                regreso con beneficios en tus propios programas de lealtad.
              </p>
            </div>
            <div className="business-visit-journey">
              <div className="business-visit-step">
                <span className="business-visit-icon">
                  <Shop aria-hidden="true" />
                </span>
                <h3>Invita a nuevos clientes</h3>
                <p>Llega a personas que están cerca de tu negocio.</p>
              </div>
              <div className="business-visit-step">
                <span className="business-visit-icon">
                  <Star aria-hidden="true" />
                </span>
                <h3>Premia su regreso</h3>
                <p>Crea beneficios que motiven a volver.</p>
              </div>
            </div>
          </section>

          <section
            className="section network-section"
            id="red"
            aria-labelledby="network-title"
          >
            <div className="feature-layout">
              <div className="feature-copy">
                <h2 id="network-title">
                  Tu próximo cliente compra cerca.{" "}
                  <em>Invítalo a conocerte.</em>
                </h2>
                <p className="feature-lede">
                  Con Venta cruzada, una persona que compra en otro comercio
                  cercano puede recibir un beneficio de tu negocio. Tú eliges
                  qué ofrecer para darle un motivo para entrar.
                </p>
                <ul className="feature-list">
                  <li>
                    <span aria-hidden="true">
                      <ArrowUpRight className="landing-icon" />
                    </span>
                    <div>
                      <strong>Un beneficio que invita a conocerte</strong>
                      <p>
                        Un regalo de bienvenida puede ser el primer paso. El
                        cliente recibe la invitación en su teléfono y decide
                        cuándo visitar tu local.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span aria-hidden="true">
                      <ArrowUpRight className="landing-icon" />
                    </span>
                    <div>
                      <strong>Tu campaña, con tus condiciones</strong>
                      <p>
                        Elige el beneficio y configura la campaña. CheckPass
                        entrega las invitaciones automáticamente cuando se
                        cumplen sus condiciones.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span aria-hidden="true">
                      <ArrowUpRight className="landing-icon" />
                    </span>
                    <div>
                      <strong>Más oportunidades en tu barrio</strong>
                      <p>
                        Con la campaña de Venta cruzada, una persona que compra
                        en otro comercio cercano puede recibir un regalo tuyo y
                        un motivo para visitar tu local.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
              <NetworkPreview />
            </div>
            <div className="start-actions">
              <SignupLink label="Pruébalo gratis 3 meses" />
              <p>Todo incluido durante la prueba.</p>
            </div>
            <div className="section-more section-more-left">
              <a className="text-link" href="/marketing-para-comercios">
                Descubre cómo funciona el marketing para tu negocio <Arrow />
              </a>
            </div>
          </section>

          <section
            className="section loyalty-section"
            id="programa"
            aria-labelledby="loyalty-title"
          >
            <div className="section-heading">
              <h2 id="loyalty-title">
                Dales un motivo para volver a <em>elegirte.</em>
              </h2>
              <p>
                Tus clientes se unen con el QR de tu local. Sus compras o las
                acciones que definas en el programa les permiten acumular puntos
                o sellos y canjear tus recompensas cuando cumplen sus
                condiciones.
              </p>
            </div>
            <LoyaltyJourney />
            <div className="section-more">
              <a className="text-link" href="/programa-de-fidelizacion">
                Descubre el programa de recompensas para tu negocio <Arrow />
              </a>
            </div>
          </section>

          <section
            className="feature-section"
            id="beneficios"
            aria-labelledby="benefits-title"
          >
            <div className="feature-layout">
              <div className="feature-copy">
                <h2 id="benefits-title">
                  Dedica menos tiempo a cobrar y más a <em>tus clientes.</em>
                </h2>
                <p className="feature-lede">
                  Un sistema de punto de venta en tu teléfono para gestionar tu
                  catálogo, tomar pedidos y cobrar. Con el programa de
                  fidelización integrado, también puedes reconocer a tus
                  clientes y premiarlos al atenderlos.
                </p>
                <ul className="feature-list">
                  <li>
                    <span aria-hidden="true">
                      <ArrowUpRight className="landing-icon" />
                    </span>
                    <div>
                      <strong>Tu catálogo listo con ayuda de IA</strong>
                      <p>
                        Carga una foto o un PDF de tu menú y usa la IA para
                        preparar tu catálogo de productos.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span aria-hidden="true">
                      <ArrowUpRight className="landing-icon" />
                    </span>
                    <div>
                      <strong>De la mesa al cobro, desde tu teléfono</strong>
                      <p>
                        Crea y administra las mesas de tu local, toma pedidos y
                        cobra. También puedes imprimir tickets por Bluetooth con
                        una impresora y un dispositivo compatibles.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span aria-hidden="true">
                      <ArrowUpRight className="landing-icon" />
                    </span>
                    <div>
                      <strong>Cobra y recompensa en el mismo lugar</strong>
                      <p>
                        Escanea el pase para identificar al cliente, suma puntos
                        o sellos por su compra y canjea sus premios.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
              <DashboardPreview />
            </div>
            <div className="start-actions">
              <SignupLink label="Pruébalo gratis 3 meses" />
              <p>Todo incluido durante la prueba.</p>
            </div>
            <div className="section-more section-more-left">
              <a className="text-link" href="/punto-de-venta">
                Descubre el punto de venta para tu negocio <Arrow />
              </a>
            </div>
          </section>

          <section
            className="section intro-section"
            id="como-funciona"
            aria-labelledby="how-title"
          >
            <div className="section-heading">
              <h2 id="how-title">
                Prepara tu negocio e invita a <em>tu primer cliente.</em>
              </h2>
              <p>
                Configura lo que necesitas para empezar. Puedes sumar las demás
                herramientas a medida que las necesites.
              </p>
            </div>
            <div className="steps">
              <article>
                <span className="step-number">01</span>
                <h3>Prepara tu local</h3>
                <p>
                  Completa los datos de tu negocio. Añade productos y mesas si
                  vas a usar el punto de venta.
                </p>
              </article>
              <article>
                <span className="step-number">02</span>
                <h3>Activa tu programa</h3>
                <p>Elige puntos o sellos y el premio que ofrecerás.</p>
              </article>
              <article>
                <span className="step-number">03</span>
                <h3>Invita a tu primer cliente</h3>
                <p>Comparte el QR de tu local para que se una a tu programa.</p>
              </article>
            </div>
            <div className="start-actions">
              <SignupLink label="Pruébalo gratis 3 meses" />
              <p>Todo incluido durante la prueba.</p>
            </div>
          </section>

          <ClosingSections showEyebrows={false} />
        </main>

        <LandingFooter showPhotoCredit={false} />
      </div>
    </>
  );
}
