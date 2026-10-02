import type { Metadata } from "next";
import { BrandMark } from "../brand-mark";
import Image from "next/image";
import { Explorer } from "../explore/explorer";
import { consumerWalletUrl, siteUrl } from "../site-config";
import "../explore/explore.css";

export const metadata: Metadata = {
  title: "Explora negocios locales en Cuenca",
  description:
    "Descubre cafés, restaurantes, tiendas y espacios de bienestar en Cuenca con CheckPass Club. Conoce cómo volver a tus lugares favoritos puede traer nuevas recompensas.",
  alternates: { canonical: "/explorar" },
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "es_EC",
    url: `${siteUrl}/explorar`,
    title: "Explora Cuenca | CheckPass Club",
    description:
      "Encuentra nuevos lugares para disfrutar en Cuenca y descubre CheckPass Club.",
    siteName: "CheckPass Club",
  },
  twitter: {
    card: "summary_large_image",
    title: "Explora Cuenca | CheckPass Club",
  },
};

const faqs = [
  {
    question: "¿Cómo encuentro negocios cerca de mí?",
    answer:
      "El explorador comienza en Cuenca y permite buscar por nombre, categoría o barrio. Los negocios y horarios que ves ahora son ejemplos para probar la experiencia; los perfiles reales llegarán después.",
  },
  {
    question: "¿Necesito crear una cuenta para explorar?",
    answer:
      "No. Podrás descubrir negocios sin crear una cuenta. Si ya tienes un pase CheckPass, puedes entrar a tu billetera desde esta página.",
  },
  {
    question: "¿Cómo participo en un programa de recompensas?",
    answer:
      "Visita un negocio participante y escanea su código QR allí. El explorador no inscribe a nadie en un programa.",
  },
];

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "CheckPass Club",
        url: `${siteUrl}/explorar`,
        areaServed: {
          "@type": "City",
          name: "Cuenca",
          address: { "@type": "PostalAddress", addressCountry: "EC" },
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "CheckPass Club",
        inLanguage: "es-EC",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "WebPage",
        "@id": `${siteUrl}/explorar#webpage`,
        url: `${siteUrl}/explorar`,
        name: "Explora negocios locales en Cuenca | CheckPass Club",
        description:
          "Descubre lugares locales en Cuenca y conoce cómo funciona CheckPass Club.",
        inLanguage: "es-EC",
        isPartOf: { "@id": `${siteUrl}/#website` },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };

  return (
    <div className="explore-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      <header className="explore-header">
        <a className="brand" href="/" aria-label="CheckPass Club, inicio">
          <BrandMark />
          <span className="brand-name">
            checkpass<span>.</span>club
          </span>
        </a>
        <nav aria-label="Navegación principal">
          <a href="#explorar">Explorar</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="/">Para negocios</a>
        </nav>
        <a className="explore-login" href={consumerWalletUrl}>
          Mi pase <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main id="contenido">
        <section className="explore-hero" aria-labelledby="explore-title">
          <div className="explore-hero-copy">
            <span className="explore-eyebrow">CUENCA, ECUADOR</span>
            <h1 id="explore-title">
              Lugares para ir hoy. Motivos para <em>volver.</em>
            </h1>
            <p>
              Descubre cafés, mesas, tiendas y espacios de tu ciudad. Elige un
              buen lugar para visitar y conoce lo que CheckPass suma a cada
              regreso.
            </p>
            <div className="explore-hero-actions">
              <a className="explore-primary" href="#explorar">
                Explorar Cuenca <span aria-hidden="true">→</span>
              </a>
              <a className="explore-secondary" href="#como-funciona">
                Cómo funciona
              </a>
            </div>
            <p className="explore-hero-foot">
              Una ciudad. Nuevas posibilidades de volver.
            </p>
          </div>
          <figure className="explore-hero-photo">
            <Image
              src="/images/cuenca-centro.jpg"
              alt="Calle del centro histórico de Cuenca con sus cúpulas y arquitectura tradicional"
              width={1600}
              height={2847}
              sizes="(max-width: 800px) 100vw, 46vw"
              priority
            />
            <figcaption>Centro Histórico · Cuenca, Ecuador</figcaption>
          </figure>
        </section>

        <section
          className="explore-directory"
          id="explorar"
          aria-labelledby="directory-title"
        >
          <div className="explore-section-heading">
            <div>
              <span className="explore-eyebrow">EXPLORA LA CIUDAD</span>
              <h2 id="directory-title">
                Empieza por un lugar que te <em>llame.</em>
              </h2>
            </div>
            <p>
              Busca por barrio, elige una categoría o mira qué está abierto.
              Cada visita empieza con una buena decisión.
            </p>
          </div>
          <div className="explore-demo-notice">
            <p>
              <strong>Prototipo interactivo.</strong> Nombres, fotos, horarios y
              beneficios de las fichas son ejemplos. No representan comercios
              participantes ni ofertas vigentes.
            </p>
          </div>
          <Explorer />
        </section>

        <section
          className="explore-story"
          id="como-funciona"
          aria-labelledby="story-title"
        >
          <div className="explore-story-intro">
            <span className="explore-eyebrow">ASÍ FUNCIONA CHECKPASS</span>
            <h2 id="story-title">
              Descubrir es el inicio. Volver también cuenta.
            </h2>
            <p>
              Conoce un lugar, visítalo y escanea su QR allí. Tu pase guarda el
              progreso para la siguiente vez.
            </p>
          </div>
          <div className="explore-steps">
            <article>
              <span className="explore-step-number">01</span>
              <h3>Encuentra un lugar</h3>
              <p>
                Explora negocios de tu ciudad y elige dónde pasar un buen
                momento.
              </p>
            </article>
            <article>
              <span className="explore-step-number">02</span>
              <h3>Visítalo y escanea</h3>
              <p>
                En el local, escanea su QR para conocer el programa y comenzar a
                participar.
              </p>
            </article>
            <article>
              <span className="explore-step-number">03</span>
              <h3>Haz que cuente</h3>
              <p>
                Guarda tu pase, suma tus visitas y descubre lo que te espera al
                volver.
              </p>
            </article>
          </div>
        </section>

        <section className="explore-merchant" aria-labelledby="merchant-title">
          <div>
            <span className="explore-eyebrow">¿TIENES UN NEGOCIO?</span>
            <h2 id="merchant-title">
              Hazte parte de los lugares a los que quieren <em>volver.</em>
            </h2>
            <p>
              Conoce cómo CheckPass Club puede ayudarte a crear una relación más
              cercana con tus clientes.
            </p>
          </div>
          <a href="/">
            CheckPass para negocios <span aria-hidden="true">→</span>
          </a>
        </section>

        <section className="explore-faq" aria-labelledby="explore-faq-title">
          <div>
            <span className="explore-eyebrow">LO ESENCIAL</span>
            <h2 id="explore-faq-title">
              Preguntas para <em>empezar.</em>
            </h2>
          </div>
          <div className="explore-faq-list">
            {faqs.map((faq) => (
              <details key={faq.question}>
                <summary>
                  {faq.question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="explore-footer">
        <div>
          <a className="brand" href="/" aria-label="CheckPass Club, inicio">
            <BrandMark />
            <span className="brand-name">
              checkpass<span>.</span>club
            </span>
          </a>
          <p>Más motivos para volver. Empezamos en Cuenca.</p>
        </div>
        <nav aria-label="Navegación del pie de página">
          <a href="#explorar">Explorar</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="/">Para negocios</a>
          <a href={consumerWalletUrl}>Mi pase</a>
          <a href="/es/privacy">Privacidad</a>
          <a href="/es/tos">Términos de uso</a>
        </nav>
        <small>
          © {new Date().getFullYear()} CheckPass Club · Cuenca, Ecuador
        </small>
        <small className="explore-photo-credit">
          Fotografías de ejemplo:{" "}
          <a href="https://www.pexels.com/photo/church-dome-and-towers-over-street-20608997/">
            Juan Villarreal
          </a>
          ,{" "}
          <a href="https://www.pexels.com/photo/coffee-shop-1833769/">
            Lisa Fotios
          </a>
          ,{" "}
          <a href="https://www.pexels.com/photo/interior-of-a-restaurant-17294748/">
            Matheus Bertelli
          </a>
          ,{" "}
          <a href="https://www.pexels.com/photo/interior-of-a-boutique-7618822/">
            Hümeyra Demirci
          </a>{" "}
          y{" "}
          <a href="https://www.pexels.com/photo/modern-yoga-studio-with-natural-lighting-35215411/">
            eran design
          </a>
          ,{" "}
          <a href="https://www.pexels.com/photo/cozy-coffee-shop-interior-with-barista-at-work-31672028/">
            Gül Işık
          </a>
          ,{" "}
          <a href="https://www.pexels.com/photo/a-table-in-a-restaurant-19647375/">
            HONG SON
          </a>
          ,{" "}
          <a href="https://www.pexels.com/photo/display-at-bookstore-20131334/">
            Terrance Barksdale
          </a>{" "}
          y{" "}
          <a href="https://www.pexels.com/photo/modern-pilates-studio-with-reformers-36833353/">
            Paulina Vargas
          </a>{" "}
          / Pexels.
        </small>
      </footer>
    </div>
  );
}
