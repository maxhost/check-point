import Image from "next/image";
import {
  BreadSlice,
  Book,
  Check,
  CoffeeCup,
  Flower,
  Gift,
  User,
} from "iconoir-react";

// Production plates regenerated from the approved comp, with UI removed.
// Identical sources: assets/plates/neighborhood.png, reward-scene.png, service-scene.png.
export function NeighborhoodScene() {
  return (
    <figure
      className="barrio-map"
      aria-label="Una compra en una panadería da un motivo para conocer un café cercano"
    >
      <Image
        src="/images/negocios-neighborhood.png"
        alt="Comercios y árboles conectados por un recorrido en las calles del barrio"
        width={1724}
        height={912}
        sizes="(max-width: 760px) calc(100vw - 80px), (max-width: 1190px) 40vw, 464px"
      />
      <div className="barrio-shop barrio-bakery">
        <CoffeeCup aria-hidden="true" />
        <span>
          Panadería <br />
          La Esquina
        </span>
      </div>
      <div className="barrio-shop barrio-bookshop">
        <Book aria-hidden="true" />
        <span>
          Librería <br />
          El Rincón
        </span>
      </div>
      <div className="barrio-shop barrio-cafe">
        <CoffeeCup aria-hidden="true" />
        <span>Café</span>
      </div>
      <div className="barrio-shop barrio-florist">
        <Flower aria-hidden="true" />
        <span>
          Floristería <br />
          Verde Aquí
        </span>
      </div>
      <div className="barrio-invitation">
        <Gift aria-hidden="true" />
        <p>
          Por tu compra en <br />
          Panadería La Esquina <br />
          <strong>
            puedes recibir un beneficio <br />
            en Café.
          </strong>
        </p>
      </div>
    </figure>
  );
}

export function RewardScene() {
  return (
    <figure className="barrio-reward">
      <Image
        src="/images/negocios-reward-scene.png"
        alt="Soporte con QR para unirse y tarjeta de recompensas: cinco compras, un café"
        width={1886}
        height={834}
        sizes="(max-width: 760px) calc(100vw - 80px), (max-width: 1190px) 40vw, 464px"
      />
    </figure>
  );
}

export function ServiceScene() {
  return (
    <div className="barrio-service-visual">
      <figure className="barrio-attention">
        <Image
          src="/images/negocios-service-scene.png"
          alt="Dueña de una cafetería atendiendo a un cliente con una tablet"
          width={1134}
          height={1387}
          sizes="(max-width: 760px) calc(100vw - 80px), (max-width: 1190px) 40vw, 464px"
        />
      </figure>
      <ol className="barrio-pos-panels" aria-label="Del pedido a la recompensa">
        <li className="barrio-order">
          <h3>1. Tomar pedido</h3>
          <div>
            <CoffeeCup aria-hidden="true" />
            <span>Café americano</span>
            <b>$3</b>
          </div>
          <div>
            <BreadSlice aria-hidden="true" />
            <span>Croissant</span>
            <b>$2</b>
          </div>
          <p>
            Total <strong>$5</strong>
          </p>
        </li>
        <li className="barrio-customer">
          <h3>2. Identificar cliente</h3>
          <div>
            <User aria-hidden="true" />
            <p>
              Laura García<span>Pase encontrado</span>
            </p>
            <Check aria-hidden="true" />
          </div>
        </li>
        <li className="barrio-redeem">
          <h3>3. Sumar o canjear</h3>
          <div>
            <Gift aria-hidden="true" />
            <p>
              +1 punto<span className="barrio-charge">Cobrar pedido</span>
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
}
