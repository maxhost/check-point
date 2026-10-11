import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CoffeeCup,
  Gift,
  Plus,
  User,
  QrCode,
} from "iconoir-react";
import { BrandMark } from "../brand-mark";
import { LandingFooter } from "../negocios/closing-sections";
import { onboardingUrl, siteUrl } from "../site-config";
import "./programa.css";

const title = "Programa de fidelización para comercios de barrio | CheckPass";
const description =
  "Dales motivos para volver con puntos o sellos. Elige recompensas, revisa las reglas antes de activar y consulta las compras y canjes de tus clientes.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/programa-de-fidelizacion" },
  openGraph: {
    type: "website",
    locale: "es_EC",
    url: `${siteUrl}/programa-de-fidelizacion`,
    title,
    description,
    siteName: "CheckPass Club",
  },
  twitter: { card: "summary", title, description },
};

const faqs = [
  {
    question: "¿Necesito usar el punto de venta?",
    answer:
      "Sí. Usa el mostrador para identificar al cliente con su pase, acreditar compras y confirmar canjes. No necesitas gestionar pedidos ni mesas para tener tu programa de fidelización.",
  },
  {
    question: "¿Cómo decido cuántos puntos o sellos entregar?",
    answer:
      "Defines las reglas de acumulación de tu programa y las recompensas. Puedes establecer cuánto debe consumir un cliente para acumular puntos o sellos. En sellos también puedes elegir la acumulación por compra. Antes de activar, revisa el consumo o las compras necesarias para alcanzar cada premio.",
  },
  {
    question: "¿Qué me dice la previsión?",
    answer:
      "Te muestra el consumo necesario para conseguir una recompensa y, cuando el premio es un producto del catálogo con precio, lo compara con su precio de venta. Si entregas sellos por compra, muestra cuántas compras hacen falta. Es una referencia basada en tus reglas: no predice ventas futuras ni calcula el margen después de costos y gastos.",
  },
  {
    question: "¿Cómo se entrega una recompensa?",
    answer:
      "Tu equipo identifica al cliente con su pase, comprueba las recompensas disponibles y confirma el canje cuando entrega el premio. La operación queda registrada en tu programa.",
  },
  {
    question: "¿Otros comercios pueden ver la actividad de mis clientes?",
    answer:
      "No. Aunque el cliente use la misma cuenta y el mismo pase en CheckPass Club, cada negocio tiene su programa y sus registros separados. Tú accedes a la actividad de tus clientes en tu comercio; otros negocios no acceden a esos registros.",
  },
  {
    question: "¿Los puntos o sellos de mi negocio se gastan en otro?",
    answer:
      "No. Los puntos y sellos que un cliente obtiene en tu negocio solo sirven para canjear las recompensas de tu negocio. Tener una cuenta común en CheckPass no mezcla los saldos de los distintos programas.",
  },
  {
    question: "¿Está disponible el cashback?",
    answer:
      "Todavía no. Está previsto para Impulso y figura como Próximamente. La idea es convertir una parte del consumo en saldo para usar en el mismo negocio. Hoy puedes empezar con puntos o sellos.",
  },
];

function SignupLink({ light = false }: { light?: boolean }) {
  return (
    <a
      className={`button ${light ? "button-light" : "button-dark"}`}
      href={onboardingUrl}
    >
      Pruébalo gratis 3 meses
      <ArrowUpRight className="landing-icon" aria-hidden="true" />
    </a>
  );
}

export default function LoyaltyProgramPage() {
  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <div className="program-page">
        <header className="site-header">
          <a className="brand" href="/" aria-label="CheckPass Club, inicio">
            <BrandMark />
            <span className="brand-name">checkpass.club</span>
          </a>
          <nav className="desktop-nav" aria-label="Navegación de fidelización">
            <a href="#tu-programa">Tu programa</a>
            <a href="#prevision">Previsión</a>
            <a href="/negocios#planes">Planes</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <a className="header-cta" href={onboardingUrl}>
            Pruébalo gratis
            <ArrowUpRight aria-hidden="true" />
          </a>
        </header>
        <main id="contenido">
          <section className="program-hero" aria-labelledby="program-title">
            <div className="hero-copy">
              <h1 id="program-title">
                Puntos o sellos. <em>Motivos para volver.</em>
              </h1>
              <p className="hero-lede">
                Premia las compras de tus clientes con un programa propio. Tú
                eliges las reglas y las recompensas; tu equipo registra las
                compras y confirma los canjes en CheckPass.
              </p>
              <div className="hero-actions">
                <SignupLink />
                <a className="text-link" href="#tu-programa">
                  Cómo funciona
                  <ArrowRight aria-hidden="true" />
                </a>
              </div>
              <p className="hero-assurance">
                <Check aria-hidden="true" />
                Todo incluido durante la prueba de tres meses.
              </p>
            </div>
            <figure
              className="program-activity"
              aria-label="Recorrido de un cliente en tu programa"
            >
              <figcaption>De la primera compra a su recompensa.</figcaption>
              <ol className="program-activity-list">
                <li>
                  <QrCode aria-hidden="true" />
                  <div>
                    <h3>Se une con tu QR</h3>
                    <p>Escanea el QR del local y se inscribe en tu programa.</p>
                  </div>
                </li>
                <li>
                  <CoffeeCup aria-hidden="true" />
                  <div>
                    <h3>Compra y acumula</h3>
                    <p>
                      Tu equipo registra la compra y acredita puntos o sellos.
                    </p>
                  </div>
                </li>
                <li>
                  <Gift aria-hidden="true" />
                  <div>
                    <h3>Canjea su recompensa</h3>
                    <p>Tu equipo entrega el premio y confirma el canje.</p>
                  </div>
                </li>
              </ol>
            </figure>
          </section>

          <section
            className="section program-transition"
            id="tu-programa"
            aria-labelledby="story-title"
          >
            <h2 id="story-title">
              Más que una <em>tarjeta de sellos.</em>
            </h2>
            <p>
              Las compras, los puntos o sellos y los canjes que registras quedan
              conectados con cada cliente. Puedes consultar ese historial para
              conocer cómo usa tu programa.
            </p>
          </section>

          <section
            className="section program-split"
            aria-labelledby="rules-title"
          >
            <div>
              <h2 id="rules-title">
                Tus reglas. <em>Tus recompensas.</em>
              </h2>
              <p>
                Elige cómo se acumula y qué premio puede conseguir tu cliente.
              </p>
              <dl className="program-modes">
                <div>
                  <dt>Sellos</dt>
                  <dd>
                    Por compra o por importe consumido. Tú defines cuántos hacen
                    falta para el premio.
                  </dd>
                </div>
                <div>
                  <dt>Puntos</dt>
                  <dd>
                    Por importe consumido. Tú defines cuántos se entregan y
                    cuántos vale cada recompensa.
                  </dd>
                </div>
              </dl>
              <p className="program-future">
                <strong>Cashback · Próximamente</strong>
                <br />
                Previsto para Impulso: una parte del consumo en saldo para usar
                en tu negocio.
              </p>
            </div>
            <figure
              className="program-rules"
              aria-label="Ejemplos de recompensas con sellos y puntos"
            >
              <div className="program-rule">
                <strong>Sellos</strong>
                <div
                  className="program-stamps"
                  role="img"
                  aria-label="3 de 6 sellos acumulados"
                >
                  {Array.from({ length: 6 }, (_, i) => (
                    <span
                      key={i}
                      className={
                        i < 3 ? "program-stamp filled" : "program-stamp"
                      }
                    />
                  ))}
                </div>
                <p className="program-rule-summary">
                  6 sellos
                  <ArrowRight aria-hidden="true" />
                  <CoffeeCup aria-hidden="true" />
                  un café
                </p>
              </div>
              <div className="program-rule">
                <strong>Puntos</strong>
                <div className="program-points-exchange">
                  <span>
                    <b>30</b> puntos
                  </span>
                  <ArrowRight aria-hidden="true" />
                  <span>
                    <CoffeeCup aria-hidden="true" />
                    Un café
                  </span>
                </div>
              </div>
            </figure>
          </section>

          <section
            className="section program-split"
            id="prevision"
            aria-labelledby="forecast-title"
          >
            <div>
              <h2 id="forecast-title">
                Revisa las reglas <em>antes de activar.</em>
              </h2>
              <p>
                Consulta cuánto debe consumir el cliente para alcanzar un premio
                y compáralo con el precio de venta de la recompensa. Ajusta tu
                programa antes de ofrecerlo.
              </p>
              <p>
                Si entregas sellos por compra, la previsión muestra cuántas
                compras hacen falta.
              </p>
            </div>
            <figure
              className="program-calculation"
              aria-label="Comparación ilustrativa de consumo y precio de venta del premio"
            >
              <figcaption>Consumo y recompensa, en perspectiva.</figcaption>
              <dl>
                <div>
                  <dt>Consumo necesario para alcanzar el premio</dt>
                  <dd>$30</dd>
                </div>
                <div>
                  <dt>Precio de venta del premio</dt>
                  <dd>$3</dd>
                </div>
              </dl>
              <p>
                Comparación ilustrativa. Los valores dependen de las reglas que
                elijas.
              </p>
            </figure>
          </section>

          <section
            className="section program-split"
            aria-labelledby="history-title"
          >
            <div>
              <h2 id="history-title">
                Reconoce sus compras. <em>Atiende mejor su próxima visita.</em>
              </h2>
              <p>
                Identifica al cliente con su pase y consulta sus compras, puntos
                y canjes. En Mostrador, encuentra los productos que compró antes
                para registrar su siguiente compra más rápido.
              </p>
              <a className="text-link" href="/punto-de-venta">
                Conoce las herramientas de atención
                <ArrowRight aria-hidden="true" />
              </a>
            </div>
            <figure
              className="program-history"
              aria-label="Ilustración de identificación con pase y consulta de historial"
            >
              <div className="program-scene-pass">
                <BrandMark />
                <strong>Su pase</strong>
                <QrCode aria-hidden="true" />
              </div>
              <div className="program-history-info">
                <h3>Su historial, a mano.</h3>
                <ul>
                  <li>Compras registradas</li>
                  <li>Puntos o sellos acumulados</li>
                  <li>Recompensas canjeadas</li>
                </ul>
                <p>Productos habituales en Mostrador.</p>
              </div>
            </figure>
          </section>

          <section
            className="section program-split"
            aria-labelledby="account-title"
          >
            <div>
              <h2 id="account-title">
                Un solo pase. <em>Tu programa sigue siendo tuyo.</em>
              </h2>
              <p>
                El cliente escanea tu QR y se identifica con Google o Apple, sin
                descargar una app. Si ya usa CheckPass, se une sin crear otra
                cuenta.
              </p>
              <ul className="program-assurances">
                <li>
                  <Check aria-hidden="true" />
                  <span>Tus puntos y sellos se canjean en tu negocio.</span>
                </li>
                <li>
                  <Check aria-hidden="true" />
                  <span>Otros comercios no ven su actividad contigo.</span>
                </li>
              </ul>
            </div>
            <figure
              className="program-account-map"
              aria-label="Ejemplo de una cuenta con saldos separados por negocio"
            >
              <figcaption>
                <User aria-hidden="true" />
                <div>
                  <strong>Una cuenta de Ana</strong>
                  <span>Un solo pase CheckPass</span>
                </div>
              </figcaption>
              <dl>
                <div>
                  <dt>Tu cafetería</dt>
                  <dd>4 sellos</dd>
                </div>
                <div>
                  <dt>Gimnasio</dt>
                  <dd>120 puntos</dd>
                </div>
              </dl>
              <p>Los saldos de los programas no se mezclan.</p>
            </figure>
          </section>

          <section
            className="section faq-section"
            id="preguntas"
            aria-labelledby="faq-title"
          >
            <div>
              <h2 id="faq-title">
                Antes de empezar <em>tu programa.</em>
              </h2>
            </div>
            <div className="faq-list">
              {faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>
                    {faq.question}
                    <Plus aria-hidden="true" />
                  </summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
          <section className="final-cta" aria-labelledby="final-title">
            <div>
              <h2 id="final-title">Pruébalo con tus clientes.</h2>
              <p>
                Define tus recompensas y registra las primeras compras. Tienes
                tres meses gratis para probar CheckPass con tu equipo.
              </p>
              <a className="text-link" href="/negocios#planes">
                Consulta los planes
                <ArrowRight aria-hidden="true" />
              </a>
            </div>
            <SignupLink light />
          </section>
        </main>
        <LandingFooter showPhotoCredit={false} compact />
      </div>
    </>
  );
}
