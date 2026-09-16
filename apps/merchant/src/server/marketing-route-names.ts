/**
 * The `METHOD /path` of every HTTP handler under `app/api/marketing/**`, written once
 * and checked from BOTH ends:
 *
 *  - `marketing-routes-coverage.test.ts` derives the same set from the FILESYSTEM and
 *    demands they are equal, so a route born without a guard cannot hide;
 *  - `marketing-routes.test.ts` demands its hand-written `HANDLERS` table covers exactly
 *    these names, so a listed route with nobody exercising its guard cannot hide either.
 *
 * The two checks live apart because only the second one needs the module mocks; the
 * sweep is a static property and loads nothing. Transitively they pin what matters: the
 * filesystem and the exercised handlers agree.
 */
export const MARKETING_ROUTE_NAMES = [
  "GET /api/marketing/audience-preview",
  "GET /api/marketing/campaigns",
  "POST /api/marketing/campaigns",
  "GET /api/marketing/campaigns/:id",
  "PATCH /api/marketing/campaigns/:id",
  "GET /api/marketing/campaigns/:id/results",
  "POST /api/marketing/campaigns/:id/activate",
  "POST /api/marketing/campaigns/:id/pause",
  "POST /api/marketing/campaigns/:id/end",
  "POST /api/marketing/campaigns/:id/archive",
];
