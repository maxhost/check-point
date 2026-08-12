import { checkinUrl } from "../demo";

export default function QaPage() {
  const url = checkinUrl();
  return (
    <main className="screen">
      <section className="card">
        <div className="hero">
          <h1>
            Bar Demo
            <br />
            Check-in QA
          </h1>
        </div>
        <div className="content">
          <p className="eyebrow">Mi Pasaporte · prototipo</p>
          {url ? (
            <>
              <p>
                Escanea este código desde tu teléfono para probar la llegada al
                local.
              </p>
              <img
                className="qr"
                src="/qa-checkin.png"
                alt={`QR para abrir ${url}`}
              />
              <p className="muted">Destino: {url}</p>
            </>
          ) : (
            <p className="notice">
              Configura <code>NEXT_PUBLIC_QA_ORIGIN</code> con una URL HTTPS y
              ejecuta <code>pnpm qa:qr</code>.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
