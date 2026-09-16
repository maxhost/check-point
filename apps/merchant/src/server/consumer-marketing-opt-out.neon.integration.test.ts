import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  seedConsumer,
} from "./counter-integration-support";
import { getDb } from "./db";
import { programMemberships } from "./schema";
import { SESSION_COOKIE } from "./consumer/core";
import { issueSession } from "./consumer/session";
import { readPlacement, readTurns } from "./marketing-read-support";
import {
  type World,
  dropWorlds,
  seedWorld,
  tickWorld,
} from "./marketing-world-support";
import { POST } from "../app/api/public/consumer/marketing-opt-out/route";

/**
 * Spec 0065, fase D — EL OPT-OUT, de punta a punta: la ruta que lo escribe y lo que el
 * tick hace despues.
 *
 * La mitad de la UI (la pestaña) tiene su render en `app/(consumer)/wallet/settings-tab.test.ts`
 * y su interacción en `settings-tab-switch.test.ts`, al lado. Lo que
 * sólo contesta una base está acá, y son dos cosas distintas:
 *
 *  1. EL AISLAMIENTO de la ruta: sin sesión 401, membresía ajena 404 (nunca 403, que
 *     confirmaría el id), y el `UPDATE` alcanza sólo la fila del consumidor de la sesión.
 *  2. EL EFECTO: apagado por LA RUTA (no sembrado por SQL, que es como lo probaba la fase
 *     A), el consumidor deja de recibir turnos de ese negocio **y conserva su ubicación de
 *     utilidad con el saldo**. Las dos mitades en la misma corrida, porque la propiedad del
 *     DoD es justamente que una no se lleve puesta a la otra.
 */

const NS = "marketing_tick_test_optout";
const worlds: World[] = [];

async function world(people: number): Promise<World> {
  const built = await seedWorld({ label: "Opt out", people });
  worlds.push(built);
  return built;
}

function request(body: unknown, sessionToken?: string): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (sessionToken) headers.cookie = `${SESSION_COOKIE}=${sessionToken}`;
  return new NextRequest(
    "https://mp.test/api/public/consumer/marketing-opt-out",
    { method: "POST", headers, body: JSON.stringify(body) },
  );
}

/** La marca, leída por SQL: la respuesta de la ruta nunca es el oráculo. */
async function readOptOut(consumerId: string, programId: string) {
  const [row] = await getDb()
    .select({ at: programMemberships.marketingOptOutAt })
    .from(programMemberships)
    .where(
      and(
        eq(programMemberships.consumerId, consumerId),
        eq(programMemberships.programId, programId),
      ),
    );
  return row?.at ?? null;
}

describe.skipIf(!integrationEnabled)(
  "opt-out de promociones del consumidor (spec 0065, fase D)",
  () => {
    afterEach(async () => {
      await dropWorlds(worlds);
    }, 120_000);

    it("apaga y vuelve a encender SU membresía, y escribe sólo `marketing_opt_out_at`", async () => {
      const built = await world(1);
      const consumerId = built.consumerIds[0];
      const token = await issueSession(consumerId);
      const before = await getDb()
        .select()
        .from(programMemberships)
        .where(eq(programMemberships.consumerId, consumerId));

      const off = await POST(
        request({ programId: built.seed.programId, optOut: true }, token),
      );
      expect(off.status).toBe(200);
      expect(await off.json()).toEqual({ marketingOptOut: true });
      expect(await readOptOut(consumerId, built.seed.programId)).toBeInstanceOf(
        Date,
      );

      const on = await POST(
        request({ programId: built.seed.programId, optOut: false }, token),
      );
      expect(on.status).toBe(200);
      expect(await on.json()).toEqual({ marketingOptOut: false });
      expect(await readOptOut(consumerId, built.seed.programId)).toBeNull();

      // NADA MÁS DE LA FILA SE MOVIÓ. Es el ítem del DoD «lo transaccional y el saldo no
      // cambian» en su forma más barata y más fuerte: se compara la fila ENTERA.
      const after = await getDb()
        .select()
        .from(programMemberships)
        .where(eq(programMemberships.consumerId, consumerId));
      expect(after).toEqual(before);
    }, 120_000);

    it("sin sesión 401, membresía ajena 404, y ninguna de las dos escribe nada", async () => {
      const built = await world(1);
      const consumerId = built.consumerIds[0];

      const anon = await POST(
        request({ programId: built.seed.programId, optOut: true }),
      );
      expect(anon.status).toBe(401);

      // Un consumidor que NO es miembro de ese programa: el `UPDATE` no alcanza ninguna
      // fila y la ruta contesta 404 — y la membresía del dueño real sigue encendida.
      const stranger = await seedConsumer();
      const strangerToken = await issueSession(stranger.id);
      const foreign = await POST(
        request(
          { programId: built.seed.programId, optOut: true },
          strangerToken,
        ),
      );
      expect(foreign.status).toBe(404);
      expect(await foreign.json()).toMatchObject({ code: "not_found" });
      expect(await readOptOut(consumerId, built.seed.programId)).toBeNull();
    }, 120_000);

    it("un `programId` que no es uuid es 400, no un 500 del driver", async () => {
      // `program_id` es una columna `uuid`: sin la validación, comparar contra un string
      // cualquiera tira `22P02` y la ruta se cae con 500 (la trampa que `CLAUDE.md` ya
      // documenta para el webhook). También cubre el cuerpo incompleto.
      const built = await world(1);
      const token = await issueSession(built.consumerIds[0]);
      for (const body of [
        { programId: "no-soy-un-uuid", optOut: true },
        { programId: built.seed.programId },
        { programId: built.seed.programId, optOut: "true" },
      ]) {
        const response = await POST(request(body, token));
        expect(response.status).toBe(400);
      }
    }, 120_000);

    it("apagado POR LA RUTA: el turno se cancela con `opt_out` y la UTILIDAD sobrevive", async () => {
      // LA SECUENCIA ES LA REAL, y hacen falta DOS ticks: el primero le da su turno y su
      // ubicación de utilidad (o sea que el pase ya dice algo), el consumidor apaga las
      // promociones desde la pestaña, y el segundo tick es el que tiene que retirar UNA de
      // las dos cosas y dejar la otra.
      //
      // Medido al escribirlo, y vale escribirlo porque cambió el diseño del caso: con UN
      // solo tick el consumidor apagado **no aparece en `pass_placement` para nada**
      // (`loadPlacementConsumerIds` sólo visita a quien tiene turno vivo o placement
      // previo), así que la mitad «la utilidad sigue» habría quedado aseverada sobre un
      // conjunto vacío — verde por ausencia, que es exactamente el falso positivo que el
      // DoD pide evitar.
      const built = await world(2);
      const [quiet, other] = built.consumerIds;
      // El saldo pone al comercio en la bolsa de UTILIDAD; el `origin_location_id` va
      // JUNTO con él y no es decorativo: el negocio tiene DOS puertas (`seedBusiness` deja
      // una y `seedWorld` agrega la geocodificada), así que sin atribución no hay puerta
      // única que mostrar y la bolsa sale vacía.
      await getDb()
        .update(programMemberships)
        .set({ stampsCount: 2, originLocationId: built.doorId })
        .where(
          and(
            eq(programMemberships.consumerId, quiet),
            eq(programMemberships.programId, built.seed.programId),
          ),
        );

      await tickWorld(built, NS);
      const first = await readPlacement(quiet);
      // `both` y no `['turn','utility']`: la puerta de la campaña y la de su saldo son LA
      // MISMA, y el ADR 0066 decidió fusionarlas en un texto en vez de gastar dos de las
      // 10 ubicaciones del pase. Por eso el caso vale: lo que el opt-out tiene que hacer
      // acá no es borrar una fila, es DEGRADAR la que hay.
      expect(first.map((slot) => slot.slotKind)).toEqual(["both"]);
      expect(first[0].relevantText).toContain("2x1 en picadas");
      expect(first[0].relevantText).toContain("2 sellos");

      const response = await POST(
        request(
          { programId: built.seed.programId, optOut: true },
          await issueSession(quiet),
        ),
      );
      expect(response.status).toBe(200);

      await tickWorld(built, NS);

      // El turno de ESE consumidor queda cancelado con su razón…
      const turns = await readTurns(built.seed.business.id);
      expect(
        turns
          .filter((turn) => turn.consumerId === quiet)
          .map((turn) => [turn.status, turn.cancelReason]),
      ).toEqual([["cancelled", "opt_out"]]);
      // …y el del vecino, mismo negocio y misma campaña, sigue vivo: el control está
      // adentro del caso, así que un tick que cancelara todo no pasaría.
      expect(
        turns
          .filter((turn) => turn.consumerId === other)
          .map((turn) => turn.status),
      ).toEqual(["active"]);

      // El pase del que se dio de baja pierde el turno y CONSERVA su saldo.
      const after = await readPlacement(quiet);
      expect(after.map((slot) => slot.slotKind)).toEqual(["utility"]);
      expect(after[0].relevantText).toContain("2 sellos");
      // La oferta se fue del texto. Sin esta línea, un slot que siguiera diciendo «2x1 en
      // picadas» con `slot_kind = 'utility'` pasaría: el `slot_kind` es una etiqueta, el
      // texto es lo que el consumidor lee en la pantalla bloqueada.
      expect(after[0].relevantText).not.toContain("2x1 en picadas");
    }, 180_000);
  },
);
