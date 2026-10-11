import { ArrowRight, ArrowUpRight, Check, Plus } from "iconoir-react";
import type { Metadata } from "next";
import { BrandMark } from "../brand-mark";
import { LandingFooter } from "../negocios/closing-sections";
import { DashboardPreview } from "../negocios/preview";
import { onboardingUrl, siteUrl } from "../site-config";
import "../negocios/negocios.css";

const title = "Punto de venta desde tu celular para comercios";
const description =
  "Prepara tu catálogo con IA, toma pedidos, administra mesas y registra cobros desde tu celular. Fidelización integrada e impresión de tickets compatible.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${siteUrl}/punto-de-venta` },
  openGraph: {
    type: "website",
    locale: "es_EC",
    url: `${siteUrl}/punto-de-venta`,
    siteName: "CheckPass Club",
    title: `${title} | CheckPass Club`,
    description,
  },
  twitter: {
    card: "summary",
    title: `${title} | CheckPass Club`,
    description,
  },
};

const questions = [
  {
    question: "¿Qué es el punto de venta de CheckPass?",
    answer:
      "Es una herramienta para preparar tu catálogo de productos, tomar pedidos y registrar cobros desde el navegador. Puedes asociar una orden a una mesa e identificar al cliente para usar tu programa de fidelización durante la atención.",
  },
  {
    question: "¿Necesito tener mesas para usarlo?",
    answer:
      "No. Las mesas son opcionales. Puedes tomar pedidos y cobrar sin configurar mesas. Si tu local las tiene, créalas para seleccionar la mesa al abrir una orden y ver cuáles están ocupadas.",
  },
  {
    question: "¿La IA carga mi catálogo automáticamente?",
    answer:
      "La IA te ayuda a preparar productos a partir de fotos o un PDF de tu menú. Revisa los nombres, precios y demás datos antes de incorporarlos a tu catálogo. También puedes añadir y editar productos manualmente.",
  },
  {
    question: "¿Puedo cobrar sin identificar al cliente?",
    answer:
      "Sí. Puedes completar una venta sin escanear un pase. Cuando el cliente participa en tu programa, identificarlo te permite sumar sus puntos o sellos o aplicar una recompensa disponible.",
  },
  {
    question: "¿Procesa pagos con tarjeta?",
    answer:
      "El punto de venta registra el cobro de la orden. No sustituye tu terminal de tarjetas ni procesa por sí mismo pagos bancarios: recibes el pago con los medios que ya utilizas en tu negocio.",
  },
  {
    question: "¿Qué necesito para imprimir tickets?",
    answer:
      "Necesitas una impresora y un dispositivo compatibles. La impresión por Bluetooth requiere un navegador con Web Bluetooth, como Chrome en Android, y una impresora BLE compatible. No todas las impresoras Bluetooth son BLE. Safari en iPhone y iPad no ofrece esta conexión directa; cuando no está disponible, se utiliza la impresión del navegador.",
  },
  {
    question: "¿Funciona sin internet?",
    answer:
      "Necesitas conexión a internet para gestionar el catálogo, las mesas y los pedidos de tu negocio. No se ofrece un modo de operación sin conexión.",
  },
  {
    question: "¿En qué plan está incluido?",
    answer:
      "El punto de venta, el catálogo con IA, las mesas y la gestión de pedidos están incluidos tanto en Conecta como en Impulso. También puedes probarlos durante los tres meses gratuitos. Consulta los planes para ver las diferencias de fidelización, campañas y locales.",
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

export default function PointOfSalePage() {
  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <div className="site-shell">
        <header className="site-header">
          <a className="brand" href="/" aria-label="CheckPass Club, inicio">
            <BrandMark />
            <span className="brand-name">
              checkpass<span>.</span>club
            </span>
          </a>
          <nav className="desktop-nav" aria-label="Navegación principal">
            <a href="/">Para tu negocio</a>
            <a href="#como-empezar">Cómo empezar</a>
            <a href="/#planes">Planes</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <a className="header-cta" href={onboardingUrl}>
            Pruébalo gratis
            <ArrowUpRight className="landing-icon" aria-hidden="true" />
          </a>
        </header>
        <main id="contenido">
          <section className="hero" aria-labelledby="pos-title">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="eyebrow-line" /> TU PUNTO DE VENTA
              </span>
              <h1 id="pos-title">
                Del pedido al cobro, <em>desde tu celular.</em>
              </h1>
              <p className="hero-lede">
                Tu catálogo, tus mesas y tus pedidos en el mismo lugar. Atiende
                con el punto de venta de CheckPass y reconoce a los clientes de
                tu programa de fidelización al cobrar.
              </p>
              <div className="hero-actions">
                <SignupLink />
                <a className="text-link" href="#como-empezar">
                  Cómo empezar
                  <ArrowRight className="landing-icon" aria-hidden="true" />
                </a>
              </div>
              <div className="hero-assurance">
                <Check className="landing-icon" aria-hidden="true" /> Incluido
                en Conecta e Impulso
              </div>
            </div>
            <div>
              <DashboardPreview />
              <p className="hero-assurance">Vista ilustrativa del producto.</p>
            </div>
          </section>

          <section className="section" aria-labelledby="tools-title">
            <div className="section-heading">
              <span className="kicker">MENOS PASOS PARA ATENDER</span>
              <h2 id="tools-title">
                Prepara lo necesario. <em>Concéntrate en tus clientes.</em>
              </h2>
              <p>
                Trabaja desde el navegador de tu teléfono, tablet o computadora
                con conexión a internet. Usa mesas si tu negocio las necesita.
              </p>
            </div>
            <div className="steps">
              <article>
                <span className="step-number">CATÁLOGO</span>
                <h3>Tu menú, con ayuda de IA</h3>
                <p>
                  Carga fotos o un PDF para preparar tus productos. Revisa el
                  resultado y ajusta nombres y precios antes de usarlos.
                </p>
              </article>
              <article>
                <span className="step-number">PEDIDOS Y MESAS</span>
                <h3>Cada orden en su lugar</h3>
                <p>
                  Crea las mesas de tu local, consulta su ocupación y toma
                  pedidos. Añade o modifica productos mientras la orden está
                  abierta.
                </p>
              </article>
              <article>
                <span className="step-number">COBRO Y FIDELIZACIÓN</span>
                <h3>Atiende y reconoce a quien vuelve</h3>
                <p>
                  Escanea el pase del cliente para sumar puntos o sellos o
                  canjear una recompensa. Registra el cobro e imprime un ticket
                  si tienes equipo compatible.
                </p>
              </article>
            </div>
            <div className="section-more section-more-left">
              <a className="text-link" href="/programa-de-fidelizacion">
                Conoce el programa de fidelización
                <ArrowRight className="landing-icon" aria-hidden="true" />
              </a>
            </div>
          </section>

          <section
            className="section intro-section"
            id="como-empezar"
            aria-labelledby="start-title"
          >
            <div className="section-heading">
              <span className="kicker">EMPIEZA CON TU NEGOCIO</span>
              <h2 id="start-title">
                Prepara tu primera <em>orden.</em>
              </h2>
            </div>
            <div className="steps">
              <article>
                <span className="step-number">01</span>
                <h3>Activa el punto de venta</h3>
                <p>
                  Registra tu negocio y activa el punto de venta desde la
                  configuración.
                </p>
              </article>
              <article>
                <span className="step-number">02</span>
                <h3>Prepara productos y mesas</h3>
                <p>
                  Añade tu catálogo manualmente o con ayuda de IA. Si atiendes
                  mesas, configura las de cada local.
                </p>
              </article>
              <article>
                <span className="step-number">03</span>
                <h3>Toma el pedido y cobra</h3>
                <p>
                  Abre una orden, selecciona los productos e identifica al
                  cliente si participa en tu programa. Registra el cobro cuando
                  esté listo.
                </p>
              </article>
            </div>
            <div className="start-actions">
              <SignupLink />
              <p>Todo incluido durante la prueba.</p>
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
                Lo que necesitas saber <em>antes de atender.</em>
              </h2>
            </div>
            <div className="faq-list">
              {questions.map(({ question, answer }) => (
                <details key={question}>
                  <summary>
                    {question}
                    <span aria-hidden="true">
                      <Plus className="landing-icon" />
                    </span>
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="final-cta" aria-labelledby="trial-title">
            <span className="kicker">PRUÉBALO EN TU NEGOCIO</span>
            <h2 id="trial-title">
              Tu próximo pedido puede empezar <em>aquí.</em>
            </h2>
            <p>
              Prueba el punto de venta, el programa de fidelización y el
              marketing de CheckPass durante tres meses gratis.
            </p>
            <SignupLink light />
          </section>
        </main>
        <LandingFooter showPhotoCredit={false} />
      </div>
    </>
  );
}
