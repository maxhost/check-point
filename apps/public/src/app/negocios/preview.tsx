import {
  ArrowDown,
  ArrowRight,
  Check,
  Circle,
  CoffeeCup,
  Gift,
  Group,
  MagicWand,
  MediaImage,
  Printer,
  QrCode,
  Shop,
} from "iconoir-react";
import Image from "next/image";

export function HeroPreview() {
  return (
    <figure className="merchant-hero-photo">
      <Image
        src="/images/negocios-hero.jpg"
        alt="Barista atendiendo a una clienta en una cafetería"
        width={1400}
        height={933}
        sizes="(max-width: 800px) 100vw, 46vw"
        preload
      />
      <figcaption>
        Tu local es el comienzo. Tu ciudad, la oportunidad.
      </figcaption>
    </figure>
  );
}

export function LoyaltyJourney() {
  const scenes = [
    { title: "Escanea y se une", description: "Sin descargar una app." },
    {
      title: "Acumula puntos o sellos",
      description: "Cada vez que te elige, está más cerca.",
    },
    {
      title: "Recibe su recompensa",
      description: "Disfruta el premio que tú elegiste.",
    },
  ];
  return (
    <ol
      className="loyalty-journey"
      aria-label="Cómo participa un cliente en tu programa de fidelización"
    >
      {scenes.map((scene, index) => (
        <li className="loyalty-moment" key={scene.title}>
          <div className="loyalty-scene" aria-hidden="true">
            {index === 0 && <QrCode className="loyalty-qr" />}
            {index === 1 && (
              <div className="loyalty-stamps">
                <span className="loyalty-stamp loyalty-stamp-earned">
                  <Check />
                </span>
                <span className="loyalty-stamp loyalty-stamp-earned">
                  <Check />
                </span>
                <span className="loyalty-stamp">
                  <Circle />
                </span>
              </div>
            )}
            {index === 2 && (
              <span className="loyalty-reward">
                <CoffeeCup />
              </span>
            )}
          </div>
          <div className="loyalty-moment-copy">
            <h3>{scene.title}</h3>
            <p>{scene.description}</p>
          </div>
          {index < 2 && (
            <span className="loyalty-next" aria-hidden="true">
              <ArrowRight className="loyalty-next-horizontal" />
              <ArrowDown className="loyalty-next-vertical" />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export function NetworkPreview() {
  return (
    <figure
      className="network-preview"
      aria-label="Ejemplo: clientes de un gimnasio, una peluquería y una veterinaria reciben un regalo para conocer tu negocio"
    >
      <div className="network-preview-heading">
        <span className="kicker">TU BARRIO, NUEVOS CLIENTES</span>
      </div>
      <div className="network-sources">
        {["Gimnasio", "Peluquería", "Veterinaria"].map((business) => (
          <div className="network-source" key={business}>
            <span className="network-people" aria-hidden="true">
              <Group />
            </span>
            <ArrowDown className="landing-icon" aria-hidden="true" />
            <strong>{business}</strong>
          </div>
        ))}
      </div>
      <div className="network-merge" aria-hidden="true">
        <ArrowDown className="landing-icon" />
      </div>
      <div className="network-gift">
        <Gift className="network-gift-icon" aria-hidden="true" />
        <span className="network-step-label">UN MOTIVO PARA CONOCERTE</span>
        <strong>Un café de bienvenida</strong>
        <p>Un regalo de tu negocio para quienes compran cerca.</p>
      </div>
      <div className="network-connector" aria-hidden="true">
        <ArrowDown className="landing-icon" />
      </div>
      <div className="network-destination">
        <Shop aria-hidden="true" />
        <span className="network-step-label">TU LOCAL</span>
        <strong>Nuevas personas descubren tu negocio</strong>
        <p>Más oportunidades de recibir nuevos clientes.</p>
      </div>
    </figure>
  );
}

export function DashboardPreview() {
  return (
    <div
      className="pos-platform-preview"
      aria-label="Ilustración de las herramientas del punto de venta: pedidos, catálogo con IA, mesas, fidelización y tickets"
    >
      <div className="pos-block pos-block-order">
        <span className="pos-block-eyebrow">TU PUNTO DE VENTA</span>
        <strong className="pos-block-title">Pedidos y cobros</strong>
        <div className="pos-order-demo">
          <div className="pos-order-heading">
            <span>Mesa 04</span>
            <CoffeeCup aria-hidden="true" />
          </div>
          <div className="pos-order-customer">
            <Check aria-hidden="true" />
            <span>Cliente identificado</span>
          </div>
          <div className="pos-order-line">
            <span>2 × Café</span>
            <span>$10</span>
          </div>
          <div className="pos-order-line">
            <span>1 × Croissant</span>
            <span>$4</span>
          </div>
          <div className="pos-order-total">
            <span>Total</span>
            <strong>$14</strong>
          </div>
          <span className="pos-order-charge">
            Cobrar <ArrowRight aria-hidden="true" />
          </span>
        </div>
        <p>Del pedido al cobro, en tu celular.</p>
      </div>
      <div className="pos-block pos-block-catalog">
        <div className="pos-catalog-visual" aria-hidden="true">
          <MediaImage />
          <ArrowRight />
          <MagicWand />
        </div>
        <strong className="pos-block-title">Tu catálogo con IA</strong>
        <p>Desde una foto o un PDF.</p>
      </div>
      <div className="pos-block pos-block-tables">
        <div className="pos-table-visual" aria-hidden="true">
          <span>01</span>
          <span>02</span>
          <span>03</span>
          <span className="pos-table-selected">04</span>
        </div>
        <strong className="pos-block-title">Cada mesa, su pedido</strong>
      </div>
      <div className="pos-block pos-block-loyalty">
        <div className="pos-loyalty-visual" aria-hidden="true">
          <Gift />
          <span>
            <Check /> +1 sello
          </span>
        </div>
        <strong className="pos-block-title">Cobra y recompensa</strong>
        <p>Fidelización integrada.</p>
      </div>
      <div className="pos-block pos-block-ticket">
        <div className="pos-ticket-visual" aria-hidden="true">
          <Printer />
          <div className="pos-ticket-paper">
            <span>TU NEGOCIO</span>
            <i />
            <i />
            <div>
              <span>Total</span>
              <b>$14</b>
            </div>
          </div>
        </div>
        <strong className="pos-block-title">Imprime su ticket</strong>
        <p>Por Bluetooth.</p>
      </div>
    </div>
  );
}
