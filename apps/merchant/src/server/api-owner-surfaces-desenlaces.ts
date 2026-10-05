import { expect } from "vitest";
import { world } from "./api-owner-surfaces-support";

/**
 * Los ORÁCULOS del camino feliz de las superficies sin gate de email, aparte de
 * `api-owner-surfaces.test.ts` por el hook `file-size` (spec 0156 C sumó tres filas). A
 * diferencia de `api-owner-surfaces-support.ts`, acá SÍ hay `expect`: son aserciones que el
 * test invoca por fila, no montaje.
 */
/**
 * EL DESENLACE POSITIVO DE CADA EXCEPCIÓN, por fila. Un `not.toBe(403)` diría lo mismo si la
 * ruta se rompiera de cualquier otra forma: acá se exige el desenlace COMPLETO del camino
 * feliz. Es el oráculo de la mutación M1 de la 0079 (y de la M1 de la 0075).
 */
export const DESENLACE_SIN_GATE: Record<
  string,
  (response: Response) => Promise<void>
> = {
  "loyalty-program/qr": async (response) => {
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    const body = await response.text();
    expect(body).toContain("<svg");
    expect(body).not.toContain("email_not_verified");
  },
  /** Spec 0156 C (ADR 0122): VER el programa. El dominio está doblado; el 200 trae el
   * negocio y el programa del doble. */
  "loyalty-program": async (response) => {
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.business).toEqual({ id: world.businessId });
    expect(body.program.id).toBe(world.programId);
  },
  /** Spec 0156 C: la imagen del sello pasa el guard y llega al dominio REAL, que rechaza el
   * cuerpo vacío por su tipo de contenido — un 422 del dominio, no un 403 del guard. */
  "loyalty-program/stamp-upload": async (response) => {
    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatch(/^El sello debe ser /);
  },
  /** Spec 0156 C: las plantillas de condiciones. `./db` doblado → cero filas. */
  "loyalty-terms/templates": async (response) => {
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ templates: [] });
  },
  "loyalty-program (PUT)": async (response) => {
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      programId: world.programId,
      created: true,
    });
  },
  /**
   * Spec 0083 §D5 — la TERCERA, y su desenlace es EL caso central de esa spec: el owner sin
   * email verificado recibe 200 con su primer item pendiente.
   *
   * **Spec 0085 — y ahora también prueba que la lectura de tours NO rompe la ruta.** El doble
   * de `./db` devuelve CERO filas de progreso para ese `where()` sin `.limit()`; si el `await`
   * de esa consulta volviera a devolver un objeto en vez de un array, el `catch` de la ruta
   * contestaría 503 y este `toBe(200)` sería el primero en verlo.
   */
  "onboarding/checklist": async (response) => {
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.locale).toBe("es");
    // SEIS desde el 2026-09-21: `locations` entro al catalogo (`onboarding/tours.ts`).
    expect(body.items).toHaveLength(6);
    expect(body.items[0].id).toBe("verify-email");
    expect(body.items[0].done).toBe(false);
    // Sin filas de progreso, los CINCO tours salen pendientes (fail-closed).
    expect(body.items.map((item: { done: boolean }) => item.done)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  },
};
