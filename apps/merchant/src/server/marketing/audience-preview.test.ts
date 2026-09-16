import { describe, expect, it } from "vitest";
import { parseAudiencePreviewQuery } from "./audience-preview";
import { CampaignError } from "./campaign-store";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const parse = (query: string) =>
  parseAudiencePreviewQuery(new URLSearchParams(query));

/** The thrown error, not a truthy result: a helper that swallowed a different exception
 * would make every assertion below pass for free. */
function caught(query: string): CampaignError {
  try {
    parse(query);
  } catch (error) {
    if (error instanceof CampaignError) return error;
    throw error;
  }
  throw new Error("esperaba un CampaignError y no hubo ninguno");
}

describe("parseAudiencePreviewQuery", () => {
  it("reads the days and the chosen doors", () => {
    expect(parse(`dormantDays=45&locationIds=${A},${B}`)).toEqual({
      dormantDays: 45,
      locationIds: [A, B],
    });
  });

  it("an EMPTY locationIds is legal, not an error", () => {
    // The composer previews while the owner is still choosing doors. The honest answer
    // then is «todos caen en sin local atribuible», which the decision returns on its
    // own — refusing the request would leave the screen blank instead.
    expect(parse("dormantDays=30&locationIds=")).toEqual({
      dormantDays: 30,
      locationIds: [],
    });
    expect(parse("dormantDays=30")).toEqual({
      dormantDays: 30,
      locationIds: [],
    });
  });

  it.each([
    { query: "dormantDays=6", why: "below the check's floor" },
    { query: "dormantDays=366", why: "above the check's ceiling" },
    { query: "dormantDays=30.5", why: "not a whole number" },
    { query: "dormantDays=treinta", why: "not a number" },
    { query: "locationIds=" + A, why: "missing altogether" },
  ])("400 `validation` when dormantDays is $why", ({ query }) => {
    const error = caught(query);
    expect(error.status).toBe(400);
    expect(error.code).toBe("validation");
    // The message travels in `fields` and not only in `error`: that is what lets the
    // composer paint it next to the input instead of at the top of the page.
    expect(error.fields).toHaveProperty("dormantDays");
  });

  it("400 `validation` when a door id is not a uuid", () => {
    // Without this the id reaches the `inArray` and Postgres answers `22P02`, which the
    // route would map to a 503 — «se cayó el servidor» for a typo in a query string.
    const error = caught(`dormantDays=30&locationIds=${A},no-soy-uuid`);
    expect(error.status).toBe(400);
    expect(error.fields).toHaveProperty("locationIds");
  });
});
