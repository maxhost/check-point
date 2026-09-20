import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  integrationEnabled,
  readLocationRow,
} from "./locations-integration-support";
import {
  campaignBody,
  campaignWorld,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";
import { createCampaign } from "./marketing/campaign-store";
import { seedMembership, seedTurn } from "./marketing-integration-support";
import { seedConsumer } from "./counter-integration-support";
import { getDb } from "./db";
import { campaignTickAudiences, products } from "./schema";

/** The session the pages under test run with; `requireOwner` itself (ADR 0044) has its
 * own tests and is not re-tested here. */
const ctx = vi.hoisted(() => ({
  session: null as null | Record<string, unknown>,
}));

// Only `useRouter` is doubled: `notFound()` has to stay REAL, because its thrown digest
// is the oracle of the two isolation cases below. Mocking the whole module would make a
// crash and a 404 indistinguishable, which is exactly what those tests separate.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

vi.mock("./auth-guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth-guards")>();
  return {
    ...actual,
    requireBackofficeSession: async () => ctx.session,
    requireOwner: async () => ctx.session,
  };
});

import BackofficePage from "../app/backoffice/page";
import NewCampaignPage from "../app/backoffice/marketing/new/page";
import MarketingPage from "../app/backoffice/marketing/page";
import CampaignDetailPage from "../app/backoffice/marketing/[id]/page";

/**
 * Spec 0065 B3 — the three backoffice PAGES against the real branch. Two DoD items live
 * here and nowhere else:
 *
 *  - the «Campañas» tile points at `/backoffice/marketing` and no longer at the spec 0015
 *    mock;
 *  - the PAGE half of the isolation item: an owner does not SEE another business's
 *    campaign — 404, never 403, because a 403 would confirm the id exists.
 */

function sessionFor(seed: { userId: string; business: { id: string } }) {
  return {
    userId: seed.userId,
    userName: "Ana",
    business: {
      id: seed.business.id,
      name: "Campañas",
      currencyCode: "USD",
      timezone: "America/Guayaquil",
    },
    membership: { role: "owner", status: "active" },
  };
}

/** Next's `notFound()` throws; this is what distinguishes «answered 404» from «blew up
 * with a driver error», which from the outside look the same. */
async function digestOf(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
  throw new Error("esperaba un notFound() y la pagina devolvio markup");
}

afterAll(dropCampaignWorlds, 120_000);

describe.skipIf(!integrationEnabled)("marketing backoffice pages", () => {
  it("the «Campañas» tile goes to the real screen, not to the spec 0015 mock", async () => {
    const seed = await campaignWorld("plus", "Tile");
    ctx.session = sessionFor(seed);

    const html = renderToStaticMarkup(await BackofficePage());

    expect(html).toContain('href="/backoffice/marketing"');
    expect(html).not.toContain("/backoffice/demo/campaigns");
    // Anti-false-green: the re-route was surgical. The spec 0015 mock is gone entirely
    // (`analytics` had no real screen and its tile was removed, not migrated), and the
    // other real sections did not move.
    expect(html).not.toContain("/backoffice/demo/");
    expect(html).toContain('href="/backoffice/locations"');
  }, 120_000);

  it("the listing shows THIS business's campaigns and not another's", async () => {
    const mine = await campaignWorld("plus", "Listado mio");
    const theirs = await campaignWorld("plus", "Listado ajeno");
    await createCampaign(mine.business.id, mine.userId, campaignBody(mine));
    await createCampaign(
      theirs.business.id,
      theirs.userId,
      campaignBody(theirs, { name: "Campaña del vecino" }),
    );
    ctx.session = sessionFor(mine);

    const html = renderToStaticMarkup(await MarketingPage());

    expect(html).toContain("Dormidos de septiembre");
    expect(html).not.toContain("Campaña del vecino");
    // No tick has run over it: the screen says so instead of showing zeros.
    expect(html).toContain("Todavía no corrió ningún tick");
  }, 120_000);

  it("the listing counts turns with the SHARED definition of «compró», not its own", async () => {
    // EL ORACULO QUE FALTABA (revision independiente de la fase B): los tres numeros del
    // listado —turnos activos, «N de M compraron»— salian de `loadTallies`, que escribia
    // `in ('purchase','coupon_redeemed')` INLINE (la tercera de cuatro copias del
    // literal). Ningun test sembraba un solo `campaign_turn` antes de leer el listado, asi
    // que estrecharlo a `'purchase'` dejaba todo verde. `campaign-screens.test.ts` pasa el
    // DTO a mano: renderiza los numeros sin ejercer la consulta.
    //
    // El turno `coupon_redeemed` es el que hace discriminar al caso: con la lista
    // estrechada, «1 de 2» pasa a «0 de 2».
    const seed = await campaignWorld("plus", "Conteos del listado");
    const campaign = await createCampaign(
      seed.business.id,
      seed.userId,
      campaignBody(seed),
    );
    const consumer = await seedConsumer();
    const membershipId = await seedMembership({
      consumerId: consumer.id,
      programId: seed.programId,
      businessId: seed.business.id,
      enrolledAt: new Date("2025-01-01T00:00:00.000Z"),
    });
    const turn = (
      status: "active" | "done",
      outcome: "coupon_redeemed" | "none" | null,
    ) =>
      seedTurn({
        campaignId: campaign.id,
        businessId: seed.business.id,
        consumerId: consumer.id,
        membershipId,
        locationId: seed.locationId,
        status,
        outcome,
      });
    await turn("active", null);
    await turn("done", "coupon_redeemed");
    await turn("done", "none");
    ctx.session = sessionFor(seed);

    const html = renderToStaticMarkup(await MarketingPage());

    expect(html).toContain("1 turnos activos");
    expect(html).toContain("1 de 2 compraron durante su ventana");
  }, 120_000);

  it("the listing shows the LAST tick's photo, not whichever row came first", async () => {
    const seed = await campaignWorld("plus", "Ultimo tick");
    const campaign = await createCampaign(
      seed.business.id,
      seed.userId,
      campaignBody(seed),
    );
    // Inserted OLDEST LAST on purpose: without `order by campaign_id, ran_at desc` the
    // `distinct on` keeps whatever the scan returned first, and the screen would show a
    // photo from a week ago while calling it «último tick».
    await getDb()
      .insert(campaignTickAudiences)
      .values([
        {
          campaignId: campaign.id,
          ranAt: new Date("2026-09-16T06:00:00.000Z"),
          total: 42,
          reachable: 18,
          noLocation: 7,
          optOut: 3,
          cooldown: 14,
        },
        {
          campaignId: campaign.id,
          ranAt: new Date("2026-09-09T06:00:00.000Z"),
          total: 99,
          reachable: 88,
          noLocation: 1,
          optOut: 0,
          cooldown: 0,
        },
      ]);
    ctx.session = sessionFor(seed);

    const html = renderToStaticMarkup(await MarketingPage());

    expect(html).toContain("Último tick: 42 personas, 18 alcanzables");
    expect(html).not.toContain("99 personas");
  }, 120_000);

  it("renders the owner's own campaign with its results section", async () => {
    const seed = await campaignWorld("plus", "Detalle");
    const campaign = await createCampaign(
      seed.business.id,
      seed.userId,
      campaignBody(seed),
    );
    ctx.session = sessionFor(seed);

    const html = renderToStaticMarkup(
      await CampaignDetailPage({
        params: Promise.resolve({ id: campaign.id }),
      }),
    );

    expect(html).toContain("Dormidos de septiembre");
    expect(html).toContain("Compraron durante su ventana");
    // A `draft` offers exactly one transition, and the door shows its NAME — derived
    // from the seed, never a literal, so a renamed fixture cannot fake this.
    expect(html).toContain(">Activar</button>");
    expect(html).toContain((await readLocationRow(seed.locationId)).name);
  }, 120_000);

  it("the composer hands the client NO internal R2 key of a product", async () => {
    const seed = await campaignWorld("plus", "Fuga");
    // A product WITH an internal key: without one the assertion below is vacuous — it
    // would pass over an empty list, which is the shape of the empty sweep `CLAUDE.md`
    // warns about (spec 0040).
    await getDb().insert(products).values({
      businessId: seed.business.id,
      name: "Picada para dos",
      imageObjectKey: "biz/secreto/producto.webp",
    });
    ctx.session = sessionFor(seed);

    // `CLAUDE.md`: a route that returns an entity to the browser NEVER serializes
    // `*ObjectKey`. The composer's coupon block offers the catalog, so the page reads
    // `id` and `name` and nothing else — the whole product DTO would put the keys into
    // the payload. Asserted over the PROPS, which is what Flight actually serializes,
    // and not over the HTML, where an unrendered prop would hide (ADR 0062).
    const element = (await NewCampaignPage()) as {
      props: { products: Record<string, unknown>[] };
    };
    expect(element.props.products).toHaveLength(1);
    expect(JSON.stringify(element.props.products)).not.toContain("secreto");
    // Exact, not a substring guard: a key added later cannot slip in unnoticed.
    expect(Object.keys(element.props.products[0]).sort()).toEqual([
      "id",
      "name",
    ]);
  }, 120_000);

  it("another business's campaign is a 404 PAGE, not a 403 and not a crash", async () => {
    const mine = await campaignWorld("plus", "Aislamiento mio");
    const theirs = await campaignWorld("plus", "Aislamiento ajeno");
    const foreign = await createCampaign(
      theirs.business.id,
      theirs.userId,
      campaignBody(theirs),
    );
    ctx.session = sessionFor(mine);

    expect(
      await digestOf(() =>
        CampaignDetailPage({ params: Promise.resolve({ id: foreign.id }) }),
      ),
    ).toContain("404");
  }, 120_000);

  it("a malformed id is a 404 too, and never reaches the driver", async () => {
    const seed = await campaignWorld("plus", "Id roto");
    ctx.session = sessionFor(seed);

    // Without the shape check Postgres raises `22P02 invalid input syntax for type
    // uuid` and the owner gets a 500 where the honest answer is «no existe». The
    // assertion is on the DIGEST, so a crash cannot pass as a 404.
    expect(
      await digestOf(() =>
        CampaignDetailPage({
          params: Promise.resolve({ id: "no-soy-un-uuid" }),
        }),
      ),
    ).toContain("404");
  }, 120_000);
});
