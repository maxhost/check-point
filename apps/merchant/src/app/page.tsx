// Spec 0067 §7: la landing queda sin NINGUNA accion y sin rebote a `/backoffice`.
// Los tres `redirect` del guard apuntan aca (`/`, `/?e=<codigo>`), asi que si esta pagina
// volviera a mandar una sesion viva al backoffice, un owner sin email verificado —o una
// sesion sin membresia— entraria en un bucle de redireccion infinito en vez de ver el
// motivo del rebote. El producto no tiene entrada por navegador hasta que aterrice la UI
// de afuera: costo aceptado por el owner (ADR 0070 §17).
export default function MerchantEntryPage() {
  return (
    <main className="merchant-shell">
      <section className="panel login-panel">
        <p className="eyebrow">CheckPass Club · Negocios</p>
        <h1>Fidelización simple para tu negocio</h1>
        <p>
          Sumá clientes con tu programa de puntos o sellos, acreditá desde el
          mostrador y llegá a tus clientes por su billetera.
        </p>
      </section>
    </main>
  );
}
