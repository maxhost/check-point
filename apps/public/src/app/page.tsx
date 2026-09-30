import type { Metadata } from "next";
import Image from "next/image";
import { DashboardPreview, HeroPreview } from "./negocios/preview";
import { ClosingSections, LandingFooter } from "./negocios/closing-sections";
import { CampaignSection } from "./negocios/campaign-section";
import { onboardingUrl, siteUrl } from "./site-config";
import "./negocios/negocios.css";

export const metadata: Metadata = {
  title: "Programa de fidelización para comercios en Cuenca",
  description:
    "Convierte visitas en relaciones duraderas. Crea un programa de puntos o sellos, premia a tus clientes y gestiona campañas con CheckPass Club. Empieza en Cuenca, Ecuador.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_EC",
    url: siteUrl,
    title: "CheckPass Club para negocios | Haz que quieran volver",
    description:
      "Fidelización y campañas para comercios locales. Crea tu programa de puntos o sellos en CheckPass Club.",
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
          "Plataforma de fidelización y marketing para comercios locales.",
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
        name: "Programa de fidelización para comercios en Cuenca | CheckPass Club",
        description:
          "Crea un programa de puntos o sellos y premia a tus clientes con CheckPass Club.",
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
            <span className="brand-symbol">
              c<span>.</span>
            </span>
            <span className="brand-name">
              checkpass<span>.</span>club
            </span>
          </a>
          <nav className="desktop-nav" aria-label="Navegación principal">
            <a href="/explorar">Explorar</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#beneficios">Beneficios</a>
            <a href="#planes">Planes</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <a className="header-cta" href={onboardingUrl}>
            Crear mi negocio <Arrow diagonal />
          </a>
        </header>

        <main id="contenido">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="eyebrow-line" /> HECHO PARA NEGOCIOS LOCALES
              </span>
              <h1 id="hero-title">
                Que cada visita sea el comienzo de la <em>siguiente.</em>
              </h1>
              <p className="hero-lede">
                Crea tu programa de puntos o sellos, premia a quienes te eligen
                y dales más razones para volver. Tus clientes llevan sus
                beneficios en el teléfono.
              </p>
              <div className="hero-actions">
                <SignupLink label="Crear mi negocio gratis" />
                <a className="text-link" href="#como-funciona">
                  Descubre cómo funciona <Arrow />
                </a>
              </div>
              <div className="hero-assurance">
                <span className="assurance-icon">✓</span> Comienza con tu
                negocio en Cuenca, Ecuador
              </div>
            </div>
            <HeroPreview />
          </section>

          <section
            className="ribbon"
            aria-label="Lo que puedes hacer con CheckPass"
          >
            <div>Tu programa, a tu manera</div>
            <div>Clientes que vuelven</div>
            <div>Más cerca de tu comunidad</div>
          </section>

          <section
            className="section intro-section"
            id="como-funciona"
            aria-labelledby="how-title"
          >
            <div className="section-heading">
              <span className="kicker">ASÍ DE SIMPLE</span>
              <h2 id="how-title">
                Tu negocio hace lo suyo.
                <br />
                <em>Nosotros te ayudamos a que vuelvan.</em>
              </h2>
              <p>
                Un programa fácil de entender para tus clientes y de usar para
                tu equipo. Empieza en tu local, donde ya suceden las mejores
                conexiones.
              </p>
            </div>
            <div className="steps">
              <article>
                <span className="step-number">01</span>
                <h3>Crea tu programa</h3>
                <p>
                  Elige puntos o sellos y define la recompensa que mejor encaja
                  con tu negocio.
                </p>
              </article>
              <article>
                <span className="step-number">02</span>
                <h3>Invita en tu local</h3>
                <p>
                  Tus clientes escanean tu QR cuando te visitan y se unen a tu
                  programa.
                </p>
              </article>
              <article>
                <span className="step-number">03</span>
                <h3>Haz que regresen</h3>
                <p>
                  Acredita sus compras o visitas y crea campañas para mantener
                  viva la relación.
                </p>
              </article>
            </div>
          </section>

          <section
            className="feature-section"
            id="beneficios"
            aria-labelledby="benefits-title"
          >
            <div className="feature-layout">
              <div className="feature-copy">
                <span className="kicker">MÁS QUE UNA TARJETA DE SELLOS</span>
                <h2 id="benefits-title">
                  Todo lo que necesitas para <em>seguir cerca.</em>
                </h2>
                <p className="feature-lede">
                  Tus clientes eligen tu negocio por muchos motivos. CheckPass
                  te ayuda a darles uno más para volver.
                </p>
                <ul className="feature-list">
                  <li>
                    <span>↗</span>
                    <div>
                      <strong>Un programa propio</strong>
                      <p>Puntos o sellos, con premios que tú defines.</p>
                    </div>
                  </li>
                  <li>
                    <span>↗</span>
                    <div>
                      <strong>Una relación que continúa</strong>
                      <p>
                        Campañas y beneficios para mantenerte presente entre
                        visitas.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>↗</span>
                    <div>
                      <strong>Una experiencia más sencilla</strong>
                      <p>
                        Tu equipo acredita y valida desde el mostrador; tus
                        clientes encuentran sus programas en una sola cuenta,
                        desde la PWA o su pase de Apple o Google Wallet.
                      </p>
                    </div>
                  </li>
                </ul>
                <a className="text-link feature-link" href={onboardingUrl}>
                  Empieza con tu negocio <Arrow />
                </a>
              </div>
              <DashboardPreview />
            </div>
          </section>

          <CampaignSection />

          <section className="local-section" aria-labelledby="local-title">
            <figure className="local-photo">
              <Image
                src="/images/cuenca-centro.jpg"
                alt="Vista del Centro Histórico de Cuenca"
                width={1600}
                height={2847}
                sizes="(max-width: 800px) 100vw, 40vw"
              />
            </figure>
            <div>
              <span className="kicker">NACIDO PARA LO LOCAL</span>
              <h2 id="local-title">
                Los negocios que hacen especial a una ciudad merecen ser
                descubiertos.
              </h2>
              <p>
                Empezamos en Cuenca. Cuando completes el perfil de tu negocio,
                podrá formar parte de la red CheckPass para que más personas
                conozcan lo que haces.
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
