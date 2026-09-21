import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type Montaje,
  altaDe,
  desmontar,
  filaDe,
  montarDosNegocios,
  patch,
  renombreIntegrationEnabled as enabled,
  setStatus,
} from "./staff-rename-integration-support";

/**
 * Spec 0087 §5 (enmienda del 2026-09-21) — **UN INTEGRANTE DADO DE BAJA NO SE RENOMBRA.**
 *
 * Decision del owner, textual: *«integrante dado de baja se puede renombrar: no»*.
 *
 * Es un archivo aparte y no tres `it` mas en `staff-rename.neon.integration.test.ts`: ese
 * archivo estaba en **285 de 300 lineas** y la regla del repo es dividir, no extender. El
 * montaje es **el mismo** (`staff-rename-integration-support.ts`), asi que las dos suites no
 * pueden terminar midiendo mundos distintos.
 *
 * **Por que contra la base y no con un doble:** los tres casos se deciden leyendo una fila
 * —el `status` y el `business_id` de la membresia— y el tercero, que es el que importa,
 * depende de que las dos condiciones se evaluen en el ORDEN correcto. Con `getDb` doblado se
 * estaria midiendo el doble.
 */
describe.skipIf(!enabled)("el renombre de un integrante DADO DE BAJA", () => {
  let montaje: Montaje;
  let businessIds: Montaje["businessIds"];
  let slugs: Montaje["slugs"];
  let cookieOwnerA = "";
  /** Dado de baja en A: el target de los dos primeros casos. */
  let bajaA = "";
  /** Dado de baja en B: el vector que prueba que el `code` nuevo NO filtra existencia. */
  let bajaB = "";

  beforeAll(async () => {
    montaje = await montarDosNegocios("renstatus");
    ({ businessIds, slugs, cookieOwnerA } = montaje);

    bajaA = await altaDe(montaje, cookieOwnerA, "Baja A");
    bajaB = await altaDe(montaje, montaje.cookieOwnerB, "Baja B");
    // La baja se hace por la RUTA REAL, no con un `UPDATE` a mano: es la unica forma de que
    // la fila quede como queda en produccion (y de paso, que el montaje falle ruidoso si esa
    // ruta se rompe).
    for (const [cookie, userId] of [
      [cookieOwnerA, bajaA],
      [montaje.cookieOwnerB, bajaB],
    ] as const) {
      const response = await setStatus(cookie, userId, "disabled");
      if (response.status !== 200) {
        throw new Error(`el montaje no pudo dar de baja a ${userId}`);
      }
    }
  }, 180_000);

  afterAll(async () => {
    await desmontar(montaje);
  }, 120_000);

  /** El `code` es 409 y no 404 a proposito: `listStaff` NO filtra por `status`, asi que el
   * merchant VE al desactivado en su lista y un 404 le mentiria sobre algo que tiene en
   * pantalla. El mensaje nombra la salida: reactivarlo, que es reversible. */
  it("un `disabled` del PROPIO negocio → 409 `target_disabled`, y su fila no se movió", async () => {
    const antes = await filaDe(businessIds.a, bajaA);
    expect(antes?.status).toBe("disabled");

    const response = await patch(cookieOwnerA, bajaA, { name: "Nombre Nuevo" });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("target_disabled");

    // Ni el nombre ni el handle: la fila ENTERA tiene que estar como estaba.
    expect(await filaDe(businessIds.a, bajaA)).toEqual(antes);
  }, 180_000);

  /** CONTROL POSITIVO en el mismo vector: sin él, un writer que rechazara TODO renombre
   * pasaria el caso de arriba. Y es la salida que el mensaje del 409 promete. */
  it("reactivado con `POST …/status`, el MISMO integrante se renombra → 200", async () => {
    const reactivado = await altaDe(montaje, cookieOwnerA, "Vuelve Carla");
    expect((await setStatus(cookieOwnerA, reactivado, "disabled")).status).toBe(
      200,
    );
    expect(
      (await patch(cookieOwnerA, reactivado, { name: "Carla Reactivada" }))
        .status,
    ).toBe(409);

    expect((await setStatus(cookieOwnerA, reactivado, "active")).status).toBe(
      200,
    );
    const response = await patch(cookieOwnerA, reactivado, {
      name: "Carla Reactivada",
    });
    expect(response.status).toBe(200);
    expect((await response.json()).staff.identifier).toBe(
      `carla-reactivada@${slugs.a}`,
    );
    expect((await filaDe(businessIds.a, reactivado))?.handle).toBe(
      "carla-reactivada",
    );
  }, 180_000);

  /**
   * EL CASO QUE IMPIDE QUE EL `code` NUEVO FILTRE EXISTENCIA: un `disabled` de OTRO negocio
   * recibe **404 `staff_not_found`**, la misma respuesta que un id fantasma. Si el `status`
   * se mirara ANTES del scope por negocio, contestaria `409 target_disabled` y estaria
   * confirmando que ese id existe —y ademas en que estado esta— a alguien de otro negocio.
   */
  it("un `disabled` de OTRO negocio → 404 `staff_not_found`, NO 409", async () => {
    const antesB = await filaDe(businessIds.b, bajaB);
    const response = await patch(cookieOwnerA, bajaB, { name: "Robado" });
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("staff_not_found");
    expect(await filaDe(businessIds.b, bajaB)).toEqual(antesB);
  }, 180_000);
});
