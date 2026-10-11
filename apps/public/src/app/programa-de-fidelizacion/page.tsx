import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Circle,
  CoffeeCup,
  Gift,
  Plus,
  User,
  QrCode,
} from "iconoir-react";
import { BrandMark } from "../brand-mark";
import { LandingFooter } from "../negocios/closing-sections";
import { onboardingUrl, siteUrl } from "../site-config";
import "../negocios/negocios.css";
import "./programa.css";

const title = "Programa de fidelización para comercios de barrio | CheckPass";
const description =
  "Conoce mejor a tus clientes con un programa de puntos o sellos. Define tus reglas, revisa el valor de las recompensas y registra la actividad de tu negocio.";

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
    question: "¿Puedo usar el programa sin el punto de venta de CheckPass?",
    answer:
      "Sí. Usa el mostrador para identificar al cliente con su pase, acreditar compras y confirmar canjes. No necesitas gestionar pedidos ni mesas para tener tu programa de fidelización.",
  },
  {
    question: "¿Cómo decido cuántos puntos o sellos entregar?",
    answer:
      "Defines las reglas de acumulación de tu programa y las recompensas. Puedes establecer cuánto debe consumir un cliente para acumular puntos o sellos. En sellos también puedes elegir la acumulación por compra. Antes de activar, revisa el consumo o las compras necesarias para alcanzar cada premio.",
  },
  {
    question: "¿La previsión me dice cuánto voy a ganar?",
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
      <div className="site-shell program-page">
        <header className="site-header">
          <a className="brand" href="/" aria-label="CheckPass Club, inicio">
            <BrandMark />
            <span className="brand-name">
              checkpass<span>.</span>club
            </span>
          </a>
          <nav className="desktop-nav" aria-label="Navegación principal">
            <a href="#tu-programa">Tu programa</a>
            <a href="#prevision">Previsión</a>
            <a href="/#planes">Planes</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <a className="header-cta" href={onboardingUrl}>
            Pruébalo gratis
            <ArrowUpRight className="landing-icon" aria-hidden="true" />
          </a>
        </header>

        <main id="contenido">
          <section className="hero" aria-labelledby="program-title">
            <div className="hero-copy">
              <span className="eyebrow">
                FIDELIZACIÓN PARA COMERCIOS DE BARRIO
              </span>
              <h1 id="program-title">
                Conoce mejor a quienes <em>vuelven a tu negocio.</em>
              </h1>
              <p className="hero-lede">
                Un programa de puntos o sellos para tu negocio de barrio. Tú
                defines las recompensas; CheckPass registra las compras y los
                canjes para ayudarte a conocer a tus clientes y atenderlos
                mejor.
              </p>
              <div className="hero-actions">
                <SignupLink />
                <a className="text-link" href="#tu-programa">
                  Cómo funciona
                  <ArrowRight className="landing-icon" aria-hidden="true" />
                </a>
              </div>
              <p className="program-origin">
                Acercamos a los comercios de barrio herramientas que suelen
                tener las grandes cadenas, a un precio accesible.
              </p>
              <p className="hero-assurance">Todo incluido durante la prueba</p>
            </div>
            <figure className="program-activity">
              <ol className="program-activity-grid">
                <li className="program-activity-join">
                  <div className="program-join-visual" aria-hidden="true">
                    <QrCode />
                    <User />
                  </div>
                  <div>
                    <span className="program-activity-number">01</span>
                    <h3>Se une a tu programa</h3>
                    <p>El cliente escanea el QR de tu local.</p>
                  </div>
                </li>
                <li className="program-activity-earn">
                  <span className="program-activity-number">02</span>
                  <div className="program-earn-visual" aria-hidden="true">
                    <Circle />
                    <Circle />
                    <Circle />
                  </div>
                  <h3>Compra y avanza</h3>
                  <p>Tu equipo registra la compra y entrega puntos o sellos.</p>
                </li>
                <li className="program-activity-redeem">
                  <span className="program-activity-number">03</span>
                  <Gift className="program-gift-visual" aria-hidden="true" />
                  <h3>Disfruta su premio</h3>
                  <p>Tu equipo entrega la recompensa y confirma el canje.</p>
                </li>
              </ol>
            </figure>
          </section>

          <section
            className="section program-transition"
            id="tu-programa"
            aria-labelledby="story-title"
          >
            <span className="kicker">DEL CARTÓN A LA INFORMACIÓN</span>
            <h2 id="story-title">
              Del cartón de sellos a <em>un historial que puedes consultar.</em>
            </h2>
            <p>
              Una tarjeta de sellos da motivos para volver, pero es difícil
              saber cómo la usan. Con CheckPass, las compras, la acumulación y
              los canjes que registras quedan conectados con cada cliente.
            </p>
          </section>

          <section
            className="section program-split"
            aria-labelledby="rules-title"
          >
            <div className="feature-copy">
              <span className="kicker">TUS REGLAS, TUS RECOMPENSAS</span>
              <h2 id="rules-title">
                Tú decides cómo se gana <em>cada recompensa.</em>
              </h2>
              <p className="feature-lede">
                Elige puntos o sellos. Define cómo se acumulan y qué recompensas
                pueden canjear tus clientes.
              </p>
              <p>
                En sellos, puedes elegir la acumulación por compra o por importe
                consumido. En puntos, defines cuántos entrega cada importe y
                cuántos vale cada premio.
              </p>
              <p className="program-future">
                <strong>Cashback · Próximamente</strong>
                <br />
                Una parte del consumo convertida en saldo para usar en tu
                negocio. Previsto para Impulso.
              </p>
            </div>
            <figure
              className="program-rules"
              aria-label="Ejemplos de recompensas con sellos y puntos"
            >
              <div className="program-rule">
                <span className="kicker">SELLOS</span>
                <div
                  className="program-stamps"
                  aria-label="3 de 6 sellos acumulados"
                >
                  {Array.from({ length: 6 }, (_, i) => (
                    <Circle
                      key={i}
                      className={
                        i < 3 ? "program-stamp filled" : "program-stamp"
                      }
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className="program-rule-summary">
                  6 sellos <ArrowRight aria-hidden="true" />
                  <CoffeeCup aria-hidden="true" /> un café
                </p>
              </div>
              <div className="program-rule">
                <span className="kicker">PUNTOS</span>
                <div className="program-points-exchange">
                  <strong>
                    30 <span>puntos</span>
                  </strong>
                  <ArrowRight aria-hidden="true" />
                  <div>
                    <CoffeeCup aria-hidden="true" />
                    <span>Un café</span>
                  </div>
                </div>
              </div>
            </figure>
          </section>

          <section
            className="feature-section program-forecast"
            id="prevision"
            aria-labelledby="forecast-title"
          >
            <div className="program-forecast-inner">
              <div className="section-heading">
                <span className="kicker">ANTES DE ACTIVAR</span>
                <h2 id="forecast-title">
                  Revisa los números antes de <em>ofrecer el premio.</em>
                </h2>
                <p>
                  Revisa cuánto debe consumir un cliente para alcanzar cada
                  premio. Ajusta las reglas de acumulación o las recompensas
                  antes de activar tu programa.
                </p>
              </div>
              <figure className="program-calculation">
                <div className="program-calculation-values">
                  <div>
                    <strong>$30</strong>
                    <span>de consumo necesario</span>
                  </div>
                  <ArrowRight
                    className="program-calculation-arrow"
                    aria-hidden="true"
                  />
                  <div>
                    <strong>$3</strong>
                    <span>de valor del premio</span>
                  </div>
                </div>
                <p className="program-ratio">
                  Por cada canje, quedan <strong>$27</strong> después de
                  descontar el valor del premio.
                </p>
              </figure>
            </div>
          </section>

          <section
            className="section program-split"
            aria-labelledby="history-title"
          >
            <div className="feature-copy">
              <span className="kicker">INFORMACIÓN PARA ATENDER MEJOR</span>
              <h2 id="history-title">
                Consulta su historial y <em>atiéndelos más rápido.</em>
              </h2>
              <p className="feature-lede">
                Identifica al cliente con su pase para consultar sus compras,
                puntos y canjes. En Mostrador, encuentra los productos que
                compró antes para registrar su próxima compra más rápido.
              </p>
              <p>
                Usa ese historial como referencia para revisar tu oferta y las
                recompensas de tu programa.
              </p>
              <a className="text-link" href="/punto-de-venta">
                Conoce las herramientas de atención
                <ArrowRight className="landing-icon" aria-hidden="true" />
              </a>
            </div>
            <figure
              className="program-history"
              aria-label="Pase ilustrativo con QR para identificar al cliente y consultar su historial"
            >
              <div className="program-scene-pass">
                <BrandMark />
                <span>Su pase</span>
                <QrCode aria-hidden="true" />
              </div>
            </figure>
          </section>

          <section className="feature-section" aria-labelledby="account-title">
            <div className="feature-layout program-account-layout">
              <div className="feature-copy">
                <span className="kicker">
                  UNA CUENTA, PROGRAMAS INDEPENDIENTES
                </span>
                <h2 id="account-title">
                  Tus clientes usan una sola cuenta.{" "}
                  <em>Cada negocio mantiene su programa.</em>
                </h2>
                <p className="feature-lede">
                  Escanean el QR de tu local y se identifican con Google o
                  Apple, sin un formulario largo ni descargar una app. Si ya
                  usan CheckPass, se unen sin crear otra cuenta.
                </p>
                <ul className="program-assurances">
                  <li>
                    <Check aria-hidden="true" />
                    <span>Tus puntos y sellos se canjean contigo.</span>
                  </li>
                  <li>
                    <Check aria-hidden="true" />
                    <span>
                      Otros comercios no ven su actividad en tu negocio.
                    </span>
                  </li>
                </ul>
              </div>
              <figure className="program-account-map">
                <div className="program-account-person">
                  <User aria-hidden="true" />
                  <strong>Una cuenta de Ana</strong>
                  <span>Un solo pase CheckPass</span>
                </div>
                <div className="program-account-branches" aria-hidden="true" />
                <div className="program-businesses">
                  <div>
                    <span>Tu cafetería</span>
                    <strong>4 sellos</strong>
                    <p>Para tus recompensas</p>
                  </div>
                  <div>
                    <span>Gimnasio</span>
                    <strong>120 puntos</strong>
                    <p>Para sus recompensas</p>
                  </div>
                </div>
                <p className="program-separation">
                  Los saldos de los programas no se mezclan.
                </p>
              </figure>
            </div>
          </section>

          <section
            className="section faq-section"
            id="preguntas"
            aria-labelledby="faq-title"
          >
            <div>
              <span className="kicker">PREGUNTAS FRECUENTES</span>
              <h2 id="faq-title">
                Los detalles de <em>tu programa.</em>
              </h2>
            </div>
            <div className="faq-list">
              {faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>
                    {faq.question}
                    <Plus className="landing-icon" aria-hidden="true" />
                  </summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="final-cta" aria-labelledby="final-title">
            <span className="kicker">FIDELIZACIÓN EN TU DÍA A DÍA</span>
            <h2 id="final-title">
              Prueba tu programa con tus clientes <em>durante tres meses.</em>
            </h2>
            <p>
              Define tus recompensas, invita a tus clientes y empieza a
              registrar la actividad de tu programa. Tienes tres meses gratis
              para probar CheckPass con tu equipo.
            </p>
            <SignupLink light />
            <div className="section-more">
              <a className="text-link" href="/#planes">
                Consulta los planes
                <ArrowRight className="landing-icon" aria-hidden="true" />
              </a>
            </div>
          </section>
        </main>
        <LandingFooter showPhotoCredit={false} />
      </div>
    </>
  );
}
