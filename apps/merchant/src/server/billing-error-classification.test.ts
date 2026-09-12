import { describe, expect, it } from "vitest";

import { BillingError, billingErrorResponse } from "../app/api/billing/_auth";

/**
 * Spec 0063, D6 — LA FORMA DEL FALLO de `api/billing/**`, como UNIT. Sale del barrido
 * sistemático de afirmaciones (S3): el docblock de `billingErrorResponse` afirma que «lo que
 * no sea un `BillingError` es un 503: NUNCA se filtra el mensaje de una excepción cualquiera»,
 * y filtrarlo dejaba los 39 tests de integración en verde. Ninguno pasaba por ese camino.
 *
 * Va como unit y no en un `*.neon.integration` a propósito: `billingErrorResponse` es una
 * función pura sobre un `unknown`, así que acá corre SIEMPRE —sin base y sin `skipIf`— y el
 * caso peligroso (una excepción de infraestructura) se construye a mano, que es justamente lo
 * que ninguna ruta produce a pedido.
 */
describe("billingErrorResponse (spec 0063, D6)", () => {
  it("una excepción cualquiera es 503 `unavailable` y NO filtra su mensaje", async () => {
    const interna = new Error(
      "connect ECONNREFUSED 10.0.0.7:5432 (ep-frosty-dawn-123456.us-east-2.aws.neon.tech)",
    );
    const response = billingErrorResponse(
      interna,
      "No pudimos actualizar tu suscripción. Vuelve a intentarlo.",
    );
    expect(response.status).toBe(503);

    const body = await response.json();
    // EL ORDEN IMPORTA: primero lo que el docblock promete con «nunca» —ni el host, ni el
    // puerto, ni el texto del error—, para que el rojo NOMBRE la fuga en vez de reportar un
    // `toEqual` opaco entre dos objetos de 2 claves.
    const serializado = JSON.stringify(body);
    expect(serializado).not.toContain("ECONNREFUSED");
    expect(serializado).not.toContain("neon.tech");
    expect(serializado).not.toContain("5432");
    expect(body).toEqual({
      error: "No pudimos actualizar tu suscripción. Vuelve a intentarlo.",
      code: "unavailable",
    });
  });

  it("un `BillingError` SÍ viaja: status, `code` y `archiveCount`", async () => {
    const response = billingErrorResponse(
      new BillingError(409, "downgrade_blocked", "Archiva 2.", 2),
      "fallback que no se usa",
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Archiva 2.",
      code: "downgrade_blocked",
      archiveCount: 2,
    });
  });

  it("sin `archiveCount`, la clave NO aparece en el cuerpo", async () => {
    // La UI distingue «hay que archivar N» de «no hay nada que archivar» por la AUSENCIA de la
    // clave, no por un `0` ni por un `undefined` serializado.
    const response = billingErrorResponse(
      new BillingError(409, "already_on_plan", "Ya estás en el plan Free."),
      "fallback",
    );
    expect(Object.keys(await response.json()).sort()).toEqual([
      "code",
      "error",
    ]);
  });
});
