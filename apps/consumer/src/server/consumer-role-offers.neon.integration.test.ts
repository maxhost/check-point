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

useRoleConnection();

/**
 * Spec 0118 — ORACULO POSITIVO del rol del cliente: «Mis beneficios». Listar las ofertas
 * cruzada y de horas valle (lee campañas, comercios, suscripciones, locales, ventanas,
 * pedidos, canjes y cupones), reclamar cada una (el `FOR UPDATE` de la campaña exige el
 * `UPDATE (updated_at)` de la 0059, y el cupon es un `INSERT` en `campaign_coupon`) y la
 * lista de cupones. Corre con el reloj REAL: la ventana de valle abre los 7 dias de 0 a 24.
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
  it("GET cross-offers: lista la cruzada y la de valle del mundo", async () => {
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
    expect(mine.map((o) => o.type).sort()).toEqual(["cross", "valley"]);
  });

  it("POST claim (cruzada): 201 con el cupon escrito; el segundo reclamo es 200 con el mismo", async () => {
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

  it("POST claim (valle): 201 con el cupon atado al local de la ventana abierta", async () => {
    const response = await claim(world.valleyId, {
      ...gps,
      locationId: world.valleyLocation,
    });
    expect(response.status).toBe(201);
    const rows = await owner`select valley_location_id from core.campaign_coupon
      where campaign_id = ${world.valleyId} and consumer_id = ${member.id}`;
    expect(rows).toEqual([{ valley_location_id: world.valleyLocation }]);
  });

  it("GET coupons: los dos cupones reclamados, vigentes", async () => {
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
    expect(mine.map((c) => c.status)).toEqual(["valid", "valid"]);
  });
});
