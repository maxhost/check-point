import { randomUUID } from "node:crypto";
import { getDb } from "@mi-pasaporte/db";
import { locations } from "@mi-pasaporte/db/schema";
import {
  seedOwnerDeNegocio,
  cookieDe,
  conCookie,
} from "../permissions-integration-support";
import { POST, GET } from "../../app/api/staff/people/route";
import { PATCH } from "../../app/api/staff/people/[personId]/route";
import { PUT as ACCESS } from "../../app/api/staff/people/[personId]/access/route";
import { PUT as LOCATIONS } from "../../app/api/staff/people/[personId]/locations/route";

export async function staffPeopleWorld() {
  const id = randomUUID(),
    ownerId = `people-${randomUUID()}`,
    slug = `people-${id.slice(0, 8)}`;
  await seedOwnerDeNegocio(ownerId, id, slug);
  const rows = await getDb()
    .insert(locations)
    .values(
      ["Uno", "Dos", "Tres"].map((name) => ({
        businessId: id,
        name,
        addressLabel: "Quito",
        countryCode: "EC",
        addressSnapshot: {},
      })),
    )
    .returning({ id: locations.id });
  const cookie = await cookieDe(ownerId);
  return {
    business: { id, slug },
    ownerId,
    cookie,
    users: [ownerId],
    locations: rows.map((l) => l.id).sort(),
  };
}
export const peopleApi = {
  create: (cookie: string, body: unknown) =>
    POST(conCookie("/api/staff/people", "POST", cookie, body)),
  list: (cookie: string, month = "2026-02") =>
    GET(conCookie(`/api/staff/people?month=${month}`, "GET", cookie)),
  rename: (cookie: string, id: string, body: unknown) =>
    PATCH(conCookie(`/api/staff/people/${id}`, "PATCH", cookie, body), {
      params: Promise.resolve({ personId: id }),
    }),
  access: (cookie: string, id: string, body: unknown) =>
    ACCESS(conCookie(`/api/staff/people/${id}/access`, "PUT", cookie, body), {
      params: Promise.resolve({ personId: id }),
    }),
  locations: (cookie: string, id: string, body: unknown) =>
    LOCATIONS(
      conCookie(`/api/staff/people/${id}/locations`, "PUT", cookie, body),
      { params: Promise.resolve({ personId: id }) },
    ),
};
