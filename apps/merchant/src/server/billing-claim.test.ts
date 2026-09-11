import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { LEASE_WINDOW_SECONDS, claimStatement } from "./billing";
import * as schema from "./schema";
import { maxDuration } from "../app/api/stripe/webhook/route";

/**
 * Spec 0063, D12 (ADR 0061) — LO QUE SE PUEDE PINNEAR DEL CLAIM SIN TOCAR LA BASE.
 *
 * Archivo propio, y el motivo importa: estos dos tests nacieron dentro de
 * `billing-webhook-claim.neon.integration.test.ts`, fuera de su `skipIf`, y lo llevaron a
 * **309** lineas — 9 por encima del limite de 300 del hook `file-size`, o sea que el archivo
 * creado para respetar ese limite acabo violandolo. Lo cazo el revisor independiente corriendo
 * el hook (`EXIT=2`), no un `wc` de nadie.
 *
 * Pero el corte NO es por tamaño: es por naturaleza. **Ninguno de los dos toca Neon ni necesita
 * las env de integracion**, asi que vivir en un `.neon.integration.test.ts` los ataba a un
 * archivo que en la mayoria de las corridas se skipea entero. Aca corren SIEMPRE, que es lo que
 * su propio comentario pedia: un chequeo que solo vive detras de un skip es un chequeo que puede
 * no correr nunca.
 */
describe("el claim, sin tocar la base (spec 0063, D12.c-d)", () => {
  it("la ventana del lease es ESTRICTAMENTE MAYOR que el `maxDuration` de la ruta", () => {
    // No es cosmetico: recien pasado `maxDuration` el proceso que tomo el evento esta muerto
    // con certeza. Si la ventana fuera menor o igual, un proceso vivo podria perder su lease y
    // dos entregas trabajarian el mismo evento a la vez; si `maxDuration` subiera sin subir la
    // ventana, esto se pone rojo antes de llegar a prod. Un revisor lo verifico en el BORDE
    // (`maxDuration = 60` contra ventana 60 → rojo): la desigualdad es estricta.
    expect(typeof maxDuration).toBe("number");
    expect(LEASE_WINDOW_SECONDS).toBeGreaterThan(maxDuration);
  });

  it("el claim escribe `received_at` con el reloj de POSTGRES, no con el del proceso", () => {
    // CHEQUEO DE FORMA, etiquetado como tal. Nace de una mutacion del revisor que quedo VERDE
    // en 17/17: `sql`now()`` → `new Date()` no rompia nada, asi que el docblock de `claim.ts`
    // afirmaba sin oraculo. Importa porque el predicado del lease compara contra `now()`: con
    // el reloj de la lambda adelantado el lease duraria de mas, y atrasado expiraria antes de
    // tiempo y dos entregas trabajarian el mismo evento.
    //
    // LO QUE NO CUBRE, dicho explicitamente: el COMPORTAMIENTO con relojes desfasados, que
    // exigiria dos relojes. Cubre que la forma del statement no cambie sin que nadie lo note.
    //
    // Ejecutor SIN conexion viva: `toSQL()` solo renderiza, nunca conecta. La primera version
    // de este test llamaba a `getDb()` adentro de `claimStatement` y moria con `DATABASE_URL no
    // esta configurada` — un rojo que parecia el guard mordiendo y era el entorno.
    const offline = drizzle(neon("postgresql://u:p@example.invalid/db"), {
      schema,
    });
    const rendered = claimStatement(offline, {
      id: "evt_forma",
      type: "customer.subscription.updated",
      api_version: "2020-08-27",
    } as Stripe.Event).toSQL().sql;
    expect(rendered).toContain('set "received_at" = now()');
    // Y que NO sea un parametro: `new Date()` renderia `set "received_at" = $n`.
    expect(rendered).not.toMatch(/set "received_at" = \$/);
  });
});
