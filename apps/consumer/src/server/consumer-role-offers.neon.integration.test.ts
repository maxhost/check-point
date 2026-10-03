import { afterAll, beforeAll, expect, it } from "vitest";
import {
  GPS,
  type Member,
  type World,
  dropWorld,
  owner,
  request,
  roleSuite,
  seedMember,
  seedWorld,
  useRoleConnection,
} from "./consumer-role-support";
import { GET as listOffers } from "../app/api/public/consumer/cross-offers/route";
import { POST as claimOffer } from "../app/api/public/consumer/cross-offers/[campaignId]/claim/route";
import { GET as coupons } from "../app/api/public/consumer/coupons/route";
import { POST as click } from "../app/api/public/push/click/route";
import {
  CROSS_ON_DEMAND_ENABLED,
  campaignKindEnabled,
} from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import { claimCrossOffer } from "@mi-pasaporte/domain/server/consumer/cross-offers";

useRoleConnection();

/**
 * Spec 0118 — ORACULO POSITIVO del rol del cliente: «Mis beneficios». Listar las ofertas
 * cruzada y de horas valle (lee campañas, comercios, suscripciones, locales, ventanas,
 * pedidos, canjes y cupones), reclamar cada una (el `FOR UPDATE` de la campaña exige el
 * `UPDATE (updated_at)` de la 0060, y el cupon es un `INSERT` en `campaign_coupon`) y la
 * lista de cupones. Corre con el reloj REAL: la ventana de valle abre los 7 dias de 0 a 24.
 *
 * Spec 0138 / ADR 0115: «Horas valle» esta APAGADO — no se ofrece ni se reclama, asi que el
 * rol se prueba sobre la cruzada y el reclamo de valle se saltea mientras este apagado.
 *
 * Spec 0143 / ADR 0117 §5: la lista «a pedido» (C1/C2) esta APAGADA — con sesion responde 404
 * `not_found`; sus casos se saltean con la bandera y el cupon cruzado se emite con el MISMO
 * dominio que usaba C2 (`claimCrossOffer`), corrido como el rol. Y el clic del regalo misterio
 * (`recordPushClick` con el id de una `cross_decision`) escribe `clicked_at` bajo el rol.
 */

let world: World;
let member: Member;
const gps = { lat: GPS.latitude, lng: GPS.longitude };

beforeAll(async () => {
  world = await seedWorld();
  member = await seedMember(world);
}, 120_000);

afterAll(dropWorld, 120_000);

const claim = (campaignId: string, body: Record<string, unknown>) =>
  claimOffer(
    request(`/api/public/consumer/cross-offers/${campaignId}/claim`, {
      method: "POST",
      token: member.token,
      body,
    }),
    { params: Promise.resolve({ campaignId }) },
  );

roleSuite("rol del cliente — ofertas cruzadas, de valle y cupones", () => {
  it.skipIf(CROSS_ON_DEMAND_ENABLED)(
    "spec 0143: C1 y C2 con sesion → 404 not_found, sin emitir nada",
    async () => {
      const list = await listOffers(
        request(
          `/api/public/consumer/cross-offers?lat=${gps.lat}&lng=${gps.lng}`,
          { token: member.token },
        ),
      );
      const claimed = await claim(world.crossId, gps);
      for (const response of [list, claimed]) {
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({
          error: "No encontrado.",
          code: "not_found",
        });
      }
      const rows =
        await owner`select id from core.campaign_coupon where consumer_id = ${member.id}`;
      expect(rows).toEqual([]);
    },
  );

  it("GET cross-offers: lista la cruzada del mundo (la de valle no, apagada)", async (ctx) => {
    if (!CROSS_ON_DEMAND_ENABLED) return ctx.skip();
    const response = await listOffers(
      request(
        `/api/public/consumer/cross-offers?lat=${gps.lat}&lng=${gps.lng}`,
        { token: member.token },
      ),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      origin: string;
      offers: { type: string; campaignId: string }[];
    };
    expect(body.origin).toBe("gps");
    const mine = body.offers.filter((o) =>
      [world.crossId, world.valleyId].includes(o.campaignId),
    );
    expect(mine.map((o) => o.type).sort()).toEqual(["cross"]);
  });

  it("POST claim (cruzada): 201 con el cupon escrito; el segundo reclamo es 200 con el mismo", async (ctx) => {
    if (!CROSS_ON_DEMAND_ENABLED) return ctx.skip();
    const first = await claim(world.crossId, gps);
    expect(first.status).toBe(201);
    const rows =
      await owner`select id, cross_claimed_at from core.campaign_coupon
      where campaign_id = ${world.crossId} and consumer_id = ${member.id}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].cross_claimed_at).not.toBeNull();
    const second = await claim(world.crossId, gps);
    expect(second.status).toBe(200);
    expect(
      ((await second.json()) as { coupon: { id: string } }).coupon.id,
    ).toBe(rows[0].id);
  });

  // Spec 0143: con C2 apagada, el MISMO dominio, corrido como el rol (FOR UPDATE + INSERT).
  it.skipIf(CROSS_ON_DEMAND_ENABLED)(
    "el cupon cruzado, emitido por claimCrossOffer COMO el rol: 201",
    async () => {
      const issued = await claimCrossOffer(member.id, world.crossId, GPS);
      expect(issued.status).toBe(201);
    },
  );

  it.skipIf(!campaignKindEnabled("valley") || !CROSS_ON_DEMAND_ENABLED)(
    "POST claim (valle): 201 con el cupon atado al local de la ventana abierta",
    async () => {
      const response = await claim(world.valleyId, {
        ...gps,
        locationId: world.valleyLocation,
      });
      expect(response.status).toBe(201);
      const rows =
        await owner`select valley_location_id from core.campaign_coupon
      where campaign_id = ${world.valleyId} and consumer_id = ${member.id}`;
      expect(rows).toEqual([{ valley_location_id: world.valleyLocation }]);
    },
  );

  it("GET coupons: el cupon reclamado, vigente", async () => {
    const response = await coupons(
      request("/api/public/consumer/coupons", { token: member.token }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      coupons: { businessId: string; status: string }[];
    };
    const mine = body.coupons.filter((c) =>
      [world.cross, world.valley].includes(c.businessId),
    );
    expect(mine.map((c) => c.status)).toEqual(["valid"]);
  });
});

roleSuite("rol del cliente — el clic del regalo misterio (spec 0143)", () => {
  it("POST push/click con el id de una cross_decision: marca clicked_at bajo el rol", async () => {
    const [order] =
      await owner`insert into core."order" (business_id, program_id, membership_id, consumer_id,
        mode, total, currency_code, accrual_kind, units_granted, balance_after,
        created_by_user_id, client_request_id)
      values (${world.home}, ${world.programId}, ${member.membershipId}, ${member.id}, 'quick',
        6, 'USD', 'stamps', 1, 1, ${world.userId}, gen_random_uuid())
      returning id`;
    const [decision] =
      await owner`insert into core.cross_decision (order_id, consumer_id, business_id,
        origin_kind, policy, epsilon, candidate_count, draw, chosen_campaign_id, outcome)
      values (${order.id}, ${member.id}, ${world.home}, 'last_scan', 'h4-v1', 0.2, 1, 0.5,
        ${world.crossId}, 'issued')
      returning id`;
    const response = await click(
      request("/api/public/push/click", {
        method: "POST",
        body: { id: decision.id },
      }),
    );
    expect(response.status).toBe(204);
    const [row] =
      await owner`select clicked_at from core.cross_decision where id = ${decision.id}`;
    expect(row.clicked_at).not.toBeNull();
  });
});
