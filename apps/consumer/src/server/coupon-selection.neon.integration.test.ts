import { afterAll, beforeAll, expect, it } from "vitest";
import {
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
import {
  DELETE as dropChoice,
  PUT as choose,
} from "../app/api/public/consumer/coupon-selection/route";
import { GET as coupons } from "../app/api/public/consumer/coupons/route";

useRoleConnection();

/**
 * Spec 0148 P0-P2 — the customer CHOOSES a coupon in the PWA, and the list says «aca», through
 * the REAL routes and a real session, COMO `checkpass_consumer` (the role of the 0060: no new
 * GRANT for the choice nor for «aca»). Every state is read by SQL as the owner.
 * ORACULO DE M7 (another customer's coupon is a 404) and DE M9 (the Bienvenida «desde
 * mañana» cannot be chosen).
 */

const DAY = 86_400_000;
let world: World;
let member: Member;
let stranger: Member;
let later: Member;
let home: string;
let cross: string;
let scheduled: string;
let theirs: string;

async function coupon(opts: {
  campaignId: string;
  businessId: string;
  consumerId: string;
  membershipId: string | null;
  validFrom: Date;
  validUntil: Date;
  welcome?: boolean;
}): Promise<string> {
  const [row] =
    await owner`insert into core.campaign_coupon (campaign_id, business_id, consumer_id,
      membership_id, welcome_membership_id, cross_claimed_at, label_snapshot, cost_snapshot,
      kind_snapshot, valid_from, valid_until)
    values (${opts.campaignId}, ${opts.businessId}, ${opts.consumerId}, ${opts.membershipId},
      ${opts.welcome ? opts.membershipId : null},
      ${opts.membershipId === null ? opts.validFrom.toISOString() : null},
      'Regalo 0148', 1, 'custom', ${opts.validFrom.toISOString()},
      ${opts.validUntil.toISOString()}) returning id`;
  return String(row.id);
}

beforeAll(async () => {
  world = await seedWorld();
  member = await seedMember(world);
  stranger = await seedMember(world);
  const now = Date.now();
  // Two VALID ones: home expires first (the list's default order), cross later — a claimed
  // cross coupon, without membership.
  cross = await coupon({
    campaignId: world.crossId,
    businessId: world.cross,
    consumerId: member.id,
    membershipId: null,
    validFrom: new Date(now - DAY),
    validUntil: new Date(now + 10 * DAY),
  });
  home = await coupon({
    campaignId: world.welcomeId,
    businessId: world.home,
    consumerId: member.id,
    membershipId: member.membershipId,
    validFrom: new Date(now - DAY),
    validUntil: new Date(now + 5 * DAY),
  });
  // The Bienvenida «desde mañana» (spec 0107): `scheduled` until its `valid_from`.
  later = await seedMember(world);
  scheduled = await coupon({
    campaignId: world.welcomeId,
    businessId: world.home,
    consumerId: later.id,
    membershipId: later.membershipId,
    validFrom: new Date(now + DAY),
    validUntil: new Date(now + 15 * DAY),
    welcome: true,
  });
  theirs = await coupon({
    campaignId: world.welcomeId,
    businessId: world.home,
    consumerId: stranger.id,
    membershipId: stranger.membershipId,
    validFrom: new Date(now - DAY),
    validUntil: new Date(now + 5 * DAY),
  });
}, 120_000);

afterAll(dropWorld, 120_000);

const put = (token: string | undefined, body: unknown) =>
  choose(
    request("/api/public/consumer/coupon-selection", {
      method: "PUT",
      token,
      body,
    }),
  );
const selectionOf = async (consumerId: string) =>
  (
    await owner`select selected_coupon_id, coupon_selected_at
    from consumer.consumer_account where id = ${consumerId}`
  )[0];
async function list(query = "") {
  const response = await coupons(
    request(`/api/public/consumer/coupons${query}`, { token: member.token }),
  );
  expect(response.status).toBe(200);
  return (await response.json()) as {
    here: { businessId: string; source: string } | null;
    coupons: { id: string; selected: boolean }[];
  };
}
const mine = (body: Awaited<ReturnType<typeof list>>) =>
  body.coupons.map((c) => c.id).filter((id) => id === home || id === cross);
const pointOf = async (businessId: string) => {
  const [row] =
    await owner`select latitude, longitude from core.location where business_id = ${businessId}`;
  return `?lat=${row.latitude}&lng=${row.longitude}`;
};

roleSuite("rol del cliente — elegir el cupon (spec 0148)", () => {
  it("PUT elige, otro PUT reemplaza (el anterior queda libre), DELETE la borra", async () => {
    const first = await put(member.token, { couponId: home });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ selectedCouponId: home });
    expect((await selectionOf(member.id)).selected_coupon_id).toBe(home);
    expect((await list()).coupons.find((c) => c.id === home)?.selected).toBe(
      true,
    );

    expect((await put(member.token, { couponId: cross })).status).toBe(200);
    const after = await list();
    expect(after.coupons.filter((c) => c.selected).map((c) => c.id)).toEqual([
      cross,
    ]);

    const dropped = await dropChoice(
      request("/api/public/consumer/coupon-selection", {
        method: "DELETE",
        token: member.token,
      }),
    );
    expect(dropped.status).toBe(200);
    expect(await dropped.json()).toEqual({ selectedCouponId: null });
    expect(await selectionOf(member.id)).toEqual({
      selected_coupon_id: null,
      coupon_selected_at: null,
    });
  });

  it("ORACULO DE M7 — another customer's coupon is 404 coupon_not_found, and nothing is written", async () => {
    const response = await put(member.token, { couponId: theirs });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "coupon_not_found" });
    expect((await selectionOf(member.id)).selected_coupon_id).toBeNull();
  });

  it("ORACULO DE M9 — the Bienvenida «desde mañana» (scheduled) is 409 coupon_not_selectable", async () => {
    const response = await put(later.token, { couponId: scheduled });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "coupon_not_selectable",
    });
  });

  it("sin sesion 401 (PUT y DELETE); un couponId que no es uuid es 400 validation", async () => {
    expect((await put(undefined, { couponId: home })).status).toBe(401);
    const dropped = await dropChoice(
      request("/api/public/consumer/coupon-selection", { method: "DELETE" }),
    );
    expect(dropped.status).toBe(401);
    const invalid = await put(member.token, { couponId: "nope" });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      code: "validation",
      fields: { couponId: expect.any(String) },
    });
  });

  it("«aca»: nada → null; GPS en un local → gps; sin GPS → el ultimo escaneo; el GPS gana; sus validos primero", async () => {
    const none = await list();
    expect(none.here).toBeNull();
    expect(mine(none)).toEqual([home, cross]);

    const atCross = await list(await pointOf(world.cross));
    expect(atCross.here).toMatchObject({
      businessId: world.cross,
      source: "gps",
    });
    expect(mine(atCross)).toEqual([cross, home]);

    await owner`insert into core.business_customer (business_id, consumer_id, display_name,
      search_name, enrolled_at, last_scan_at)
      values (${world.cross}, ${member.id}, 'Ana Rol', 'ana rol', now(), now())`;
    const scanned = await list();
    expect(scanned.here).toMatchObject({
      businessId: world.cross,
      source: "last_scan",
    });
    expect(mine(scanned)).toEqual([cross, home]);

    const atHome = await list(await pointOf(world.home));
    expect(atHome.here).toMatchObject({
      businessId: world.home,
      source: "gps",
    });
    expect(mine(atHome)).toEqual([home, cross]);

    const bad = await coupons(
      request("/api/public/consumer/coupons?lat=999&lng=1", {
        token: member.token,
      }),
    );
    expect(bad.status).toBe(400);
  });
});
