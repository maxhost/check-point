import { describe, expect, it } from "vitest";
import { addLine, changeQuantity, setLineUnitPrice } from "./cart";
import type { CartLine, CounterProduct } from "./types";

/**
 * EL CARRITO DEL MOSTRADOR — los tres invariantes que su docblock declara, ahora con
 * oráculo.
 *
 * El archivo nació en la fase C de la spec 0065, extraído de `counter-console.tsx` por el
 * límite de 300 líneas, y su propio comentario dice que estas tres funciones «son la única
 * parte que un unit puede pinnear sin browser». **No se escribió ningún test**, y lo cazó la
 * revisión independiente de la fase C: tres invariantes afirmados en comentarios, a un `it`
 * de distancia. Las funciones son preexistentes (venían de la consola), así que esto cubre
 * deuda anterior a la extracción.
 */

const coffee: CounterProduct = {
  id: "p-1",
  name: "Café",
  unitPrice: 2.5,
} as CounterProduct;
const sinPrecio: CounterProduct = {
  id: "p-2",
  name: "Combo del día",
  unitPrice: null,
} as CounterProduct;

describe("addLine", () => {
  it("el mismo producto dos veces SUMA cantidad, no duplica la línea", () => {
    // Sin esto, el mismo café escaneado dos veces se lee como dos ítems distintos.
    const once = addLine([], coffee);
    const twice = addLine(once, coffee);
    expect(twice).toHaveLength(1);
    expect(twice[0]).toMatchObject({ productId: "p-1", quantity: 2 });
  });

  it("un producto SIN precio guardado entra en 0 y marcado, no como gratis", () => {
    // `hasStoredPrice: false` es lo que hace que `canConfirm` frene la venta hasta que el
    // operador tipee un precio. Un 0 sin la marca sería una venta gratis silenciosa.
    expect(addLine([], sinPrecio)[0]).toMatchObject({
      unitPrice: 0,
      hasStoredPrice: false,
    });
    expect(addLine([], coffee)[0]).toMatchObject({
      unitPrice: 2.5,
      hasStoredPrice: true,
    });
  });

  it("agregar otro producto no toca la línea que ya estaba", () => {
    const cart = addLine(addLine([], coffee), sinPrecio);
    expect(cart.map((line) => line.productId)).toEqual(["p-1", "p-2"]);
    expect(cart[0].quantity).toBe(1);
  });
});

describe("changeQuantity", () => {
  const cart: CartLine[] = [
    { productId: "p-1", name: "Café", unitPrice: 2.5, quantity: 2 },
    { productId: "p-2", name: "Medialuna", unitPrice: 1, quantity: 1 },
  ] as CartLine[];

  it("bajar a cero BORRA la línea", () => {
    // Una línea en 0 sería un ítem invisible que igual se renderiza en el carrito.
    const after = changeQuantity(cart, "p-2", -1);
    expect(after.map((line) => line.productId)).toEqual(["p-1"]);
  });

  it("sube y baja sólo la línea pedida", () => {
    expect(changeQuantity(cart, "p-1", 1)[0].quantity).toBe(3);
    expect(changeQuantity(cart, "p-1", -1)[1].quantity).toBe(1);
  });
});

describe("setLineUnitPrice", () => {
  const cart = [
    { productId: "p-1", name: "Café", unitPrice: 0, quantity: 1 },
  ] as CartLine[];
  const priceOf = (value: number) =>
    setLineUnitPrice(cart, "p-1", value)[0].unitPrice;

  it("un precio que no es un número positivo finito aterriza en 0, NUNCA en NaN", () => {
    // Un `NaN` viajaría dentro del cuerpo del request; el 0 lo frena `canConfirm`.
    expect(priceOf(Number.NaN)).toBe(0);
    expect(priceOf(Number.POSITIVE_INFINITY)).toBe(0);
    expect(priceOf(-3)).toBe(0);
    expect(priceOf(0)).toBe(0);
  });

  it("un precio válido entra tal cual", () => {
    // El control: sin esta línea, un `setLineUnitPrice` que devolviera 0 SIEMPRE pasaría
    // los cuatro casos de arriba.
    expect(priceOf(4.75)).toBe(4.75);
  });
});
