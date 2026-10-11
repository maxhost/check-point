import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock,
  Gift,
  Group,
} from "iconoir-react";
import type { Metadata } from "next";
import { BrandMark } from "./brand-mark";
import {
  DashboardPreview,
  HeroPreview,
  LoyaltyJourney,
  NetworkPreview,
} from "./negocios/preview";
import { ClosingSections, LandingFooter } from "./negocios/closing-sections";
import { onboardingUrl, siteUrl } from "./site-config";
import "./negocios/negocios.css";

export const metadata: Metadata = {
  title: "Fidelización, marketing y punto de venta | CheckPass Club",
  description:
    "Fideliza a tus clientes, activa campañas automáticas y gestiona pedidos y cobros desde tu celular. CheckPass Club para comercios en Cuenca.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_EC",
    url: siteUrl,
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
}: {
  label: string;
  light?: boolean;
}) {
  return (
    <a
      className={`button ${light ? "button-light" : "button-dark"}`}
      href={onboardingUrl}
    >
      {label} <Arrow diagonal />
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
        "@id": `${siteUrl}/#webpage`,
        url: siteUrl,
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
      <div className="site-shell">
        <header className="site-header">
          <a
            className="brand"
            href="/"
            aria-label="CheckPass Club, inicio para negocios"
          >
            <BrandMark />
            <span className="brand-name">
              checkpass<span>.</span>club
            </span>
          </a>
          <nav className="desktop-nav" aria-label="Navegación principal">
            <a href="/explorar">Explorar</a>
            <a href="#como-funciona">Cómo empezar</a>
            <a href="#red">La red</a>
            <a href="#planes">Planes</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <a className="header-cta" href={onboardingUrl}>
            Pruébalo gratis <Arrow diagonal />
          </a>
        </header>

        <main id="contenido">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="eyebrow-line" /> PARA COMERCIOS LOCALES
              </span>
              <h1 id="hero-title">
                Atrae nuevos clientes y dales motivos para <em>volver.</em>
              </h1>
              <p className="hero-lede">
                Un programa de fidelización, marketing automático y punto de
                venta para tu negocio. Reconoce a quienes te eligen, invita a
                nuevos clientes y gestiona pedidos y cobros desde tu celular.
              </p>
              <div className="hero-actions">
                <SignupLink label="Pruébalo gratis 3 meses" />
                <a className="text-link" href="#como-funciona">
                  Cómo empezar <Arrow />
                </a>
              </div>
              <div className="hero-assurance">
                <span className="assurance-icon">
                  <Check className="landing-icon" aria-hidden="true" />
                </span>{" "}
                Todo incluido durante la prueba · Empezamos en Cuenca
              </div>
            </div>
            <HeroPreview />
          </section>

          <section
            className="ribbon"
            aria-label="Lo que puedes hacer con CheckPass"
          >
            <div className="ribbon-benefit">
              <Group className="ribbon-icon" aria-hidden="true" />
              <p>
                <strong>Atrae nuevos clientes</strong>
                <span>
                  Llega a personas que viven y compran cerca de tu negocio.
                </span>
              </p>
            </div>
            <div className="ribbon-benefit">
              <Gift className="ribbon-icon" aria-hidden="true" />
              <p>
                <strong>Motívalos a volver</strong>
                <span>Premia sus compras para que vuelvan a elegirte.</span>
              </p>
            </div>
            <div className="ribbon-benefit">
              <Clock className="ribbon-icon" aria-hidden="true" />
              <p>
                <strong>Ahorra tiempo al atender</strong>
                <span>
                  Organiza pedidos y cobros desde tu celular y dedica más tiempo
                  a tus clientes.
                </span>
              </p>
            </div>
          </section>

          <section
            className="section loyalty-section"
            id="programa"
            aria-labelledby="loyalty-title"
          >
            <div className="section-heading">
              <span className="kicker">RECONOCE A QUIENES TE ELIGEN</span>
              <h2 id="loyalty-title">
                Dales un motivo para volver a <em>elegirte.</em>
              </h2>
              <p>
                Tus clientes se unen con el QR de tu local, acumulan puntos o
                sellos y canjean las recompensas que tú eliges.
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
            className="section network-section"
            id="red"
            aria-labelledby="network-title"
          >
            <div className="feature-layout">
              <div className="feature-copy">
                <span className="kicker">QUE TU BARRIO TE DESCUBRA</span>
                <h2 id="network-title">
                  ¿Cuántas personas compran cerca de ti y todavía{" "}
                  <em>no conocen tu negocio?</em>
                </h2>
                <p className="feature-lede">
                  Llega al teléfono de tus clientes y de quienes compran cerca.
                  Activa campañas automáticas con beneficios que los inviten a
                  visitarte.
                </p>
                <ul className="feature-list">
                  <li>
                    <span aria-hidden="true">
                      <ArrowUpRight className="landing-icon" />
                    </span>
                    <div>
                      <strong>Haz que tus clientes vuelvan</strong>
                      <p>
                        Los clientes inscritos en tu programa reciben avisos en
                        su teléfono con los regalos y beneficios que tú eliges.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span aria-hidden="true">
                      <ArrowUpRight className="landing-icon" />
                    </span>
                    <div>
                      <strong>Actívalo una vez. CheckPass se encarga.</strong>
                      <p>
                        Elige una campaña para dar la bienvenida, invitar a
                        quienes llevan tiempo sin venir o promocionar tus horas
                        más tranquilas. Los avisos se envían automáticamente.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span aria-hidden="true">
                      <ArrowUpRight className="landing-icon" />
                    </span>
                    <div>
                      <strong>Invita a nuevos clientes</strong>
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
            className="feature-section"
            id="beneficios"
            aria-labelledby="benefits-title"
          >
            <div className="feature-layout">
              <div className="feature-copy">
                <span className="kicker">MENOS PASOS PARA ATENDER</span>
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
              <span className="kicker">EMPIEZA CON TU NEGOCIO</span>
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

          <ClosingSections />
        </main>

        <LandingFooter />
      </div>
    </>
  );
}
