import { describe, expect, it } from "vitest";

import { CatalogError } from "./catalog/core";
import { catalogError } from "../app/api/catalog/_auth";

/**
 * Spec 0092 §3 / ADR 0086 — **EL `code` DEL CUERPO DE ERROR, que es ADITIVO.**
 *
 * El dominio catalogo no tiene lista cerrada de codigos: hasta esta spec `catalogError`
 * serializaba `{ error: message }` y punto. El 409 de la importacion en curso necesita que la
 * pantalla lo distinga **sin leer el texto**, asi que `CatalogError` gana un `code` opcional.
 *
 * Los dos casos de abajo son las dos mitades de «aditivo», y se rompen con mutaciones
 * distintas: sacar la emision del `code` tumba el primero; emitirlo SIEMPRE (`code: undefined`
 * incluido) no tumba nada —`JSON` lo omite— pero cambiar el ternario por un spread
 * incondicional con un default si. Es ORACULO DE M4 junto con la suite Neon del guard, que
 * mide la otra mitad: que el `throw` del guard traiga el `code`.
 */
describe("catalogError", () => {
  it("emite `code` cuando el CatalogError lo trae", async () => {
    const res = catalogError(
      new CatalogError(
        409,
        "Estamos importando.",
        "catalog_import_in_progress",
      ),
      "fallback",
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Estamos importando.",
      code: "catalog_import_in_progress",
    });
  });

  it("NO agrega la clave `code` cuando no hay codigo", async () => {
    const res = catalogError(new CatalogError(422, "Nombre inválido."), "fb");
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: "Nombre inválido." });
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("un error ajeno al dominio sigue siendo 503 con el fallback", async () => {
    const res = catalogError(new Error("boom"), "No pudimos cargar.");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "No pudimos cargar." });
  });
});
