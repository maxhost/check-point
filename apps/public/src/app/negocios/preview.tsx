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

export function NetworkPreview() {
  return (
    <figure
      className="network-preview"
      aria-label="Ejemplo de venta cruzada entre comercios vecinos"
    >
      <div className="network-preview-heading">
        <span className="kicker">ASÍ CONECTA LA RED</span>
        <span className="dashboard-preview-tag">EJEMPLO</span>
      </div>
      <div className="network-node">
        <span className="network-node-icon" aria-hidden="true">
          01
        </span>
        <div>
          <strong>Una compra en el café</strong>
          <p>El cliente disfruta de un lugar que ya conoce.</p>
        </div>
      </div>
      <div className="network-connector">
        <span aria-hidden="true">↓</span> Un regalo sorpresa de un comercio
        vecino
      </div>
      <div className="network-node network-node-highlight">
        <span className="network-node-icon" aria-hidden="true">
          02
        </span>
        <div>
          <strong>Una visita a tu tienda</strong>
          <p>Ahora tiene un motivo para descubrirte.</p>
        </div>
      </div>
      <div className="network-neighborhood">
        <span>Cuenca</span>
        <span>Distinto rubro · menos de 2 km</span>
      </div>
      <figcaption>
        Tú eliges el beneficio. La red abre nuevas conexiones.
      </figcaption>
    </figure>
  );
}

export function DashboardPreview() {
  return (
    <div
      className="dashboard-preview"
      aria-label="Vista ilustrativa del POS con una orden por mesa"
    >
      <div className="dashboard-preview-header">
        <span className="dashboard-preview-logo">c.</span>
        <span>checkpass.club</span>
        <span className="dashboard-preview-tag">EJEMPLO</span>
      </div>
      <div className="dashboard-preview-body">
        <div className="pos-preview-heading">
          <span className="dashboard-program-status">Mesa 04</span>
          <span>Orden abierta</span>
        </div>
        <div className="dashboard-preview-intro">
          <small>POS / PEDIDO</small>
          <strong>Todo listo para atender.</strong>
          <p>El pedido y el cliente, en el mismo lugar.</p>
        </div>
        <div className="pos-preview-client">
          <span aria-hidden="true">✓</span>
          <strong>Cliente identificado</strong>
          <span>Ana · pase escaneado</span>
        </div>
        <div className="pos-preview-items">
          <div>
            <span>2 × Café de especialidad</span>
            <span>$5,00 c/u</span>
          </div>
          <div>
            <span>1 × Croissant</span>
            <span>$4,00 c/u</span>
          </div>
        </div>
        <div className="pos-preview-total">
          <span>Total</span>
          <strong>$14,00</strong>
        </div>
        <div
          className="pos-preview-actions"
          aria-label="Ejemplo de acciones del POS, sin interacción"
        >
          <span>Ticket por Bluetooth</span>
          <strong>Cobrar →</strong>
        </div>
      </div>
      <span className="dashboard-disclaimer">
        Interfaz ilustrativa · sin datos reales
      </span>
    </div>
  );
}
