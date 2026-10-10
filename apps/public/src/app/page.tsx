import type { Metadata } from "next";
import { BrandMark } from "./brand-mark";
import {
  DashboardPreview,
  HeroPreview,
  NetworkPreview,
} from "./negocios/preview";
import { ClosingSections, LandingFooter } from "./negocios/closing-sections";
import { CampaignSection } from "./negocios/campaign-section";
import { onboardingUrl, siteUrl } from "./site-config";
import "./negocios/negocios.css";

export const metadata: Metadata = {
  title: "Red de fidelización para comercios en Cuenca",
  description:
    "Conecta con comercios de Cuenca para que nuevos clientes te descubran. Fidelización en el celular, campañas automáticas y POS con mesas en CheckPass Club.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_EC",
    url: siteUrl,
    title: "CheckPass Club | Más clientes nuevos, más razones para volver",
    description:
      "Una red de comercios en Cuenca, fidelización, campañas y POS para tu negocio local.",
    siteName: "CheckPass Club",
  },
  twitter: { card: "summary", title: "CheckPass Club para negocios" },
};

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span aria-hidden="true">{diagonal ? "↗" : "→"}</span>;
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
            <a href="#como-funciona">Cómo funciona</a>
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
                <span className="eyebrow-line" /> RED DE COMERCIOS · CUENCA
              </span>
              <h1 id="hero-title">
                Más clientes nuevos. Más razones para <em>volver.</em>
              </h1>
              <p className="hero-lede">
                Las herramientas de una gran cadena, ahora para tu negocio:
                fidelización en el celular, campañas que trabajan solas y una
                caja con mesas. Además, una red de comercios en Cuenca que ayuda
                a nuevos clientes a descubrirte.
              </p>
              <div className="hero-actions">
                <SignupLink label="Pruébalo gratis 3 meses" />
                <a className="text-link" href="#como-funciona">
                  Descubre cómo funciona <Arrow />
                </a>
              </div>
              <div className="hero-assurance">
                <span className="assurance-icon">✓</span> Todo incluido durante
                la prueba · Cuenca, Ecuador
              </div>
            </div>
            <HeroPreview />
          </section>

          <section
            className="ribbon"
            aria-label="Lo que puedes hacer con CheckPass"
          >
            <div>Que te descubran</div>
            <div>Que tus clientes vuelvan</div>
            <div>Que tu negocio atienda mejor</div>
          </section>

          <section
            className="section network-section"
            id="red"
            aria-labelledby="network-title"
          >
            <div className="feature-layout">
              <div className="feature-copy">
                <span className="kicker">TU BARRIO TAMBIÉN TE RECOMIENDA</span>
                <h2 id="network-title">
                  Tu próximo cliente ya compra <em>cerca de ti.</em>
                </h2>
                <p className="feature-lede">
                  Tu tarjeta premia a quienes ya te conocen. La red ayuda a que
                  te descubran quienes todavía no han entrado a tu local.
                </p>
                <ul className="feature-list">
                  <li>
                    <span aria-hidden="true">↗</span>
                    <div>
                      <strong>Otros comercios abren la puerta</strong>
                      <p>
                        Después de comprar en un comercio de la red, un cliente
                        puede recibir un regalo sorpresa tuyo.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span aria-hidden="true">↗</span>
                    <div>
                      <strong>Un vecino, un nuevo descubrimiento</strong>
                      <p>
                        La venta cruzada conecta negocios de rubros distintos a
                        menos de 2 km. Tú defines el beneficio que ofreces.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span aria-hidden="true">↗</span>
                    <div>
                      <strong>Tu negocio tiene un lugar en la ciudad</strong>
                      <p>
                        Una ficha pública para mostrar lo que haces y ayudarte a
                        dar el primer paso con nuevos clientes.
                      </p>
                    </div>
                  </li>
                </ul>
                <a className="text-link feature-link" href="/explorar">
                  Explora la red en Cuenca <Arrow />
                </a>
              </div>
              <NetworkPreview />
            </div>
          </section>

          <CampaignSection />

          <section
            className="feature-section"
            id="beneficios"
            aria-labelledby="benefits-title"
          >
            <div className="feature-layout">
              <div className="feature-copy">
                <span className="kicker">DEL MOSTRADOR A LA MESA</span>
                <h2 id="benefits-title">
                  Atiende con orden. Cobra con <em>confianza.</em>
                </h2>
                <p className="feature-lede">
                  Menos pasos para tu equipo. Una experiencia más profesional
                  para quien se sienta a tu mesa o compra en el mostrador.
                </p>
                <ul className="feature-list">
                  <li>
                    <span aria-hidden="true">↗</span>
                    <div>
                      <strong>Una caja que entiende tus mesas</strong>
                      <p>
                        Organiza órdenes por mesa, escanea el pase del cliente y
                        cobra. Imprime su ticket por Bluetooth desde un
                        dispositivo compatible.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span aria-hidden="true">↗</span>
                    <div>
                      <strong>Premiar también es parte de atender</strong>
                      <p>
                        Desde el mostrador, suma puntos o sellos, canjea premios
                        y valida cupones.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span aria-hidden="true">↗</span>
                    <div>
                      <strong>Tu menú listo, tu equipo preparado</strong>
                      <p>
                        Carga el catálogo con IA desde una foto o un PDF. Asigna
                        PIN y permisos al personal y organiza tus locales.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
              <DashboardPreview />
            </div>
          </section>

          <section
            className="section intro-section"
            id="como-funciona"
            aria-labelledby="how-title"
          >
            <div className="section-heading">
              <span className="kicker">ASÍ EMPIEZA TU CLUB</span>
              <h2 id="how-title">
                Tú haces lo tuyo. Nosotros te ayudamos a <em>conectar.</em>
              </h2>
              <p>
                Empieza en tu local y crece con tu ciudad. No necesitas un
                equipo de marketing para dar el primer paso.
              </p>
            </div>
            <div className="steps">
              <article>
                <span className="step-number">01</span>
                <h3>Prepara tu negocio</h3>
                <p>
                  Elige puntos o sellos, define tu premio y dale a tu tarjeta el
                  estilo de tu marca.
                </p>
              </article>
              <article>
                <span className="step-number">02</span>
                <h3>Invita con tu QR</h3>
                <p>
                  Coloca el afiche en tu local. Tus clientes escanean, se unen y
                  llevan su pase en el celular.
                </p>
              </article>
              <article>
                <span className="step-number">03</span>
                <h3>Activa la red y tus campañas</h3>
                <p>
                  Enciende los beneficios que encajan con tu negocio. Consulta
                  tus clientes y su etapa: nuevos, frecuentes o en riesgo.
                </p>
              </article>
            </div>
          </section>

          <section
            className="local-section customer-section"
            aria-labelledby="customer-title"
          >
            <div
              className="customer-pass"
              aria-label="Ejemplo de pase del cliente"
            >
              <span className="kicker">UN PASE · MUCHOS DESCUBRIMIENTOS</span>
              <strong>Tu ciudad, en tu bolsillo.</strong>
              <div className="customer-pass-row">
                <span>Café de la esquina</span>
                <span>● ● ● ○ ○ ○</span>
              </div>
              <div className="customer-pass-row">
                <span>Tu tienda favorita</span>
                <span>120 puntos</span>
              </div>
              <div className="customer-pass-gift">
                Un regalo sorpresa te espera en un comercio vecino.
              </div>
              <small>
                Ejemplo ilustrativo · cada comercio tiene su propio programa
              </small>
            </div>
            <div>
              <span className="kicker">FÁCIL DE QUERER, FÁCIL DE USAR</span>
              <h2 id="customer-title">
                Sus lugares favoritos, en una sola <em>tarjeta.</em>
              </h2>
              <p>
                Sin descargar una app. Tus clientes llevan su pase en Apple
                Wallet, Google Wallet o el navegador y reciben avisos push con
                motivos para volver.
              </p>
              <p>
                Además, pueden descubrir regalos sorpresa de comercios vecinos.
                Los puntos y sellos de cada negocio se acumulan y se canjean
                solo en ese negocio.
              </p>
            </div>
          </section>

          <ClosingSections />
        </main>

        <LandingFooter />
      </div>
    </>
  );
}
