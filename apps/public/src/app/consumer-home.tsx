import Image from "next/image";
import { ArrowRight, CoffeeCup, Gift, QrCode, Wallet } from "iconoir-react";
import { BrandMark } from "./brand-mark";
import { consumerWalletUrl, siteUrl } from "./site-config";

const questions = [
  [
    "¿Cómo me uno al programa de un negocio?",
    "Escanea el QR del local y sigue los pasos para unirte a su programa. Después podrás consultar tu pase desde el navegador.",
  ],
  [
    "¿Estos comercios y beneficios ya están disponibles?",
    "Los comercios y beneficios que mostramos son ejemplos ilustrativos para explicar CheckPass. Todavía no presentamos comercios participantes ni ofertas vigentes.",
  ],
  [
    "¿Dónde encuentro mi pase?",
    "Entra en Mi pase para consultarlo desde el navegador. También puedes guardarlo en Apple Wallet o Google Wallet cuando esa opción esté disponible para tu dispositivo.",
  ],
  [
    "¿Los puntos sirven en otros negocios?",
    "Cada comercio tiene su propio programa. Los puntos, sellos y beneficios de un negocio se acumulan y se canjean solo allí.",
  ],
];

export function ConsumerHome() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${siteUrl}/#webpage`,
    url: siteUrl,
    name: "Descubre lugares y beneficios | CheckPass Club",
    inLanguage: "es-EC",
    description:
      "Conoce cómo funciona CheckPass y explora ejemplos ilustrativos de programas y beneficios.",
  };
  return (
    <div className="consumer-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="consumer-header">
        <a
          className="consumer-brand"
          href="/"
          aria-label="CheckPass Club, inicio"
        >
          <BrandMark />
          <span>checkpass.club</span>
        </a>
        <nav aria-label="Navegación principal">
          <a href="/#como-funciona">Cómo funciona</a>
          <a href="/explorar">Explorar ejemplos</a>
          <a href="/negocios">Para tu negocio</a>
        </nav>
        <a className="consumer-pass-link" href={consumerWalletUrl}>
          Mi pase <ArrowRight aria-hidden="true" />
        </a>
      </header>
      <main id="contenido">
        <section className="consumer-hero" aria-labelledby="consumer-title">
          <div className="consumer-scene">
            <Image
              src="/images/checkpass-consumer-visit.png"
              alt="Una mujer consulta su teléfono durante una visita a una cafetería ilustrativa."
              fill
              priority
              sizes="(max-width: 700px) 100vw, 66vw"
            />
            <div
              className="consumer-notifications"
              aria-label="Ejemplo de beneficios de un café"
            >
              <div className="consumer-notice consumer-welcome">
                <BrandMark />
                <p>
                  <strong>Bienvenido a CheckPass</strong>
                  <span>Café de ejemplo</span>
                </p>
              </div>
              <div className="consumer-notice consumer-coupon">
                <Gift aria-hidden="true" />
                <p>
                  <strong>Aquí está tu cupón</strong>
                  <span>Un motivo para volver</span>
                </p>
              </div>
              <div className="consumer-notice consumer-reward">
                <CoffeeCup aria-hidden="true" />
                <p>
                  <strong>Un café de regalo</strong>
                  <span>6 sellos → un café</span>
                </p>
              </div>
            </div>
            <p className="consumer-demo-note">
              Ejemplo ilustrativo. No es una oferta vigente.
            </p>
          </div>
          <div className="consumer-hero-copy">
            <h1 id="consumer-title">
              Descubre lugares. Encuentra motivos <em>para volver.</em>
            </h1>
            <p>
              Conoce CheckPass: descubre locales, participa en sus programas y
              recibe beneficios.
            </p>
            <a className="consumer-button" href="#como-funciona">
              Ver cómo funciona <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </section>
        <section
          className="consumer-how"
          id="como-funciona"
          aria-labelledby="consumer-how-title"
        >
          <div>
            <h2 id="consumer-how-title">
              Así funciona <em>tu pase.</em>
            </h2>
            <p>
              Una visita puede ser el comienzo de algo bueno. Cada negocio elige
              su programa y los beneficios que te ofrece.
            </p>
          </div>
          <ol className="consumer-steps">
            <li>
              <div className="consumer-step-art">
                <QrCode aria-hidden="true" />
                <span>1</span>
              </div>
              <h3>Escanea y únete</h3>
              <p>En el local, escanea su QR y únete a su programa.</p>
            </li>
            <li>
              <div
                className="consumer-step-art consumer-stamps"
                aria-hidden="true"
              >
                <div>
                  {Array.from({ length: 6 }, (_, i) => (
                    <i key={i} />
                  ))}
                </div>
                <span>2</span>
              </div>
              <h3>Acumula a tu ritmo</h3>
              <p>
                Suma puntos o sellos con las compras o acciones que el negocio
                defina.
              </p>
            </li>
            <li>
              <div className="consumer-step-art">
                <CoffeeCup aria-hidden="true" />
                <span>3</span>
              </div>
              <h3>Recibe tu beneficio</h3>
              <p>
                Completa las condiciones del programa y canjea tu recompensa.
              </p>
            </li>
          </ol>
        </section>
        <section
          className="consumer-wallet consumer-section"
          aria-labelledby="consumer-wallet-title"
        >
          <Wallet aria-hidden="true" />
          <div>
            <h2 id="consumer-wallet-title">
              Tus lugares favoritos.
              <br />
              Un pase siempre a mano.
            </h2>
            <p>
              Consulta tus programas desde el navegador y guarda tu pase en
              Apple Wallet o Google Wallet. Cada comercio lleva su propio saldo
              de puntos o sellos.
            </p>
            <a className="consumer-text-link" href={consumerWalletUrl}>
              Ir a mi pase <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </section>
        <section
          className="consumer-discover consumer-section"
          aria-labelledby="consumer-discover-title"
        >
          <div>
            <h2 id="consumer-discover-title">¿Qué podrías encontrar?</h2>
            <p>
              Un café después de completar tus sellos. Puntos para tu próxima
              compra. Un beneficio para conocer un nuevo lugar.
            </p>
            <p className="consumer-example-caption">
              Por ahora, descubre ejemplos de cómo pueden ser los programas. Los
              beneficios y comercios mostrados son ilustrativos.
            </p>
            <a className="consumer-text-link" href="/explorar">
              Explorar ejemplos <ArrowRight aria-hidden="true" />
            </a>
          </div>
          <div className="consumer-example">
            <CoffeeCup aria-hidden="true" />
            <span>Café de ejemplo</span>
            <strong>
              Tu próxima pausa
              <br />
              puede tener premio.
            </strong>
            <p>Ejemplo: 6 sellos → un café</p>
          </div>
        </section>
        <section
          className="consumer-business consumer-section"
          aria-labelledby="consumer-business-title"
        >
          <div>
            <h2 id="consumer-business-title">
              ¿Tienes un negocio?
              <br />
              Dales motivos para volver.
            </h2>
            <p>
              Conoce los programas de fidelización, las campañas automáticas y
              el punto de venta de CheckPass para comercios locales.
            </p>
          </div>
          <a className="consumer-button" href="/negocios">
            Conoce CheckPass para tu negocio <ArrowRight aria-hidden="true" />
          </a>
        </section>
        <section
          className="consumer-faq consumer-section"
          id="preguntas"
          aria-labelledby="consumer-faq-title"
        >
          <h2 id="consumer-faq-title">Antes de tu primera visita.</h2>
          <div>
            {questions.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <ArrowRight aria-hidden="true" />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="consumer-footer">
        <a
          className="consumer-brand"
          href="/"
          aria-label="CheckPass Club, inicio"
        >
          <BrandMark />
          <span>checkpass.club</span>
        </a>
        <p>Más razones para volver a lo local.</p>
        <nav aria-label="Enlaces de pie de página">
          <a href="/explorar">Explorar ejemplos</a>
          <a href={consumerWalletUrl}>Mi pase</a>
          <a href="/negocios">Para tu negocio</a>
          <a href="/es/privacy">Privacidad</a>
          <a href="/es/tos">Términos</a>
        </nav>
        <small>
          © {new Date().getFullYear()} CheckPass Club · Empezamos en Cuenca
        </small>
      </footer>
    </div>
  );
}
