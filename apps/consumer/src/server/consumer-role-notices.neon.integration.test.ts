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
import { GET as notices } from "../app/api/public/consumer/notices/route";

useRoleConnection();

/**
 * Spec 0139 §3 / ADR 0116 — los avisos de mostrador de Actividad, COMO el rol del cliente
 * (`roleSuite`): como dueño la lectura pasaria sin el GRANT de la 0062 (ORACULO DE M8). Las
 * filas de la cola se siembran como dueño, con `created_at` explicito para fijar el orden.
 */

const MINUTE = 60_000;
let world: World;
let a: Member;
let b: Member;
/** Los `transactional` de A, del mas nuevo al mas viejo (lo que la ruta tiene que devolver). */
const expectedA: string[] = [];
let oldestA: string;
let bNotice: string;

async function queue(
  consumerId: string,
  klass: string,
  status: string,
  minutesAgo: number,
  body: string,
): Promise<string> {
  const [row] =
    await owner`insert into consumer.wallet_push_queue (consumer_id, class, title, body, status,
      not_before, created_at, last_error)
    values (${consumerId}, ${klass}, 'Casa 0139', ${body}, ${status},
      now() - make_interval(mins => ${minutesAgo}), now() - make_interval(mins => ${minutesAgo}),
      ${status === "suppressed" ? "no_channel" : null}) returning id`;
  return String(row.id);
}

beforeAll(async () => {
  world = await seedWorld();
  a = await seedMember(world);
  b = await seedMember(world);
  // 31 avisos de mostrador de A, en cualquier estado: el tope (30) deja afuera el mas viejo.
  const statuses = ["sent", "suppressed", "pending", "failed"];
  for (let i = 0; i < 31; i += 1) {
    const id = await queue(
      a.id,
      "transactional",
      statuses[i % 4],
      i + 1,
      `+${i} sello`,
    );
    if (i < 30) expectedA.push(id);
    else oldestA = id;
  }
  // Lo que NO es un aviso de mostrador, MAS NUEVO que todos: si se colara, encabezaria la lista.
  for (const klass of ["campaign", "reminder", "pass_refresh"])
    await queue(a.id, klass, "sent", 0, `no ${klass}`);
  // B tiene un `transactional` (ORACULO DE M6: el filtro por clase no tapa el de cliente).
  bNotice = await queue(b.id, "transactional", "sent", 0, "de B");
}, 120_000);

afterAll(dropWorld, 120_000);

roleSuite(
  "rol del cliente — avisos de mostrador en Actividad (spec 0139)",
  () => {
    it("sin sesion → 401 unauthenticated", async () => {
      const response = await notices(request("/api/public/consumer/notices"));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: "No autorizado.",
        code: "unauthenticated",
      });
    });

    it("200: solo los `transactional` de A, en cualquier estado, del mas nuevo al mas viejo, tope 30", async () => {
      const response = await notices(
        request("/api/public/consumer/notices", { token: a.token }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        notices: {
          id: string;
          title: string;
          body: string;
          createdAt: string;
        }[];
      };
      expect(body.notices.map((n) => n.id)).toEqual(expectedA);
      expect(body.notices.map((n) => n.id)).not.toContain(oldestA);
      expect(body.notices.map((n) => n.id)).not.toContain(bNotice);
      expect(body.notices[0]).toMatchObject({
        title: "Casa 0139",
        body: "+0 sello",
      });
      const created = body.notices.map((n) => Date.parse(n.createdAt));
      expect(created.every((t, i) => i === 0 || created[i - 1] >= t)).toBe(
        true,
      );
      expect(Math.abs(Date.now() - created[0])).toBeLessThan(10 * MINUTE);
    });

    // ORACULO DE M7: el DTO es una allow-list, item por item.
    it("cada item tiene EXACTAMENTE {id, title, body, createdAt} y createdAt es ISO 8601", async () => {
      const response = await notices(
        request("/api/public/consumer/notices", { token: a.token }),
      );
      const body = (await response.json()) as {
        notices: Record<string, unknown>[];
      };
      expect(body.notices.length).toBeGreaterThan(0);
      for (const notice of body.notices) {
        expect(Object.keys(notice).sort()).toEqual([
          "body",
          "createdAt",
          "id",
          "title",
        ]);
        expect(new Date(String(notice.createdAt)).toISOString()).toBe(
          notice.createdAt,
        );
      }
    });

    it("B ve solo el suyo (el aislamiento es la sesion)", async () => {
      const response = await notices(
        request("/api/public/consumer/notices", { token: b.token }),
      );
      const body = (await response.json()) as { notices: { id: string }[] };
      expect(body.notices.map((n) => n.id)).toEqual([bNotice]);
    });
  },
);
