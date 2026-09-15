import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

import {
  billingRequest,
  readSubscriptionRow,
} from "./billing-integration-support";
import {
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { dropBusiness, type Seed } from "./counter-integration-support";
import { integrationEnabled } from "./locations-integration-support";
import { getMerchantAuth } from "./auth";
import { getDb } from "./db";
import { memberships } from "./schema";
import { createStaff, setStaffStatus } from "./staff";

import { POST as CHECKOUT } from "../app/api/billing/checkout/route";
import { POST as CANCEL } from "../app/api/billing/cancel/route";
import { POST as INTERVAL } from "../app/api/billing/interval/route";
import { POST as SETTLE_FREE } from "../app/api/billing/settle-free/route";

/**
 * Spec 0063, D6 — EL GATE DE LAS 4 RUTAS CON SESIONES REALES (eran 5 hasta que la spec 0064
 * borró `resume`). Existe porque
 * `billing-routes.test.ts` NO PUEDE VER LA DISTINCIÓN que el DoD exige: con `ownerContext`
 * doblado, un staff ACTIVO y uno DESACTIVADO son el mismo `null`, así que un gate que hubiera
 * perdido el filtro `status='active'` pasaría el unit en verde. Acá la sesión se abre con
 * `signInEmail` de verdad, la cookie viaja en el request y `ownerContext` corre contra las
 * `memberships` posta.
 *
 * EL NEGOCIO ESTÁ SEMBRADO COMO A1 (`plus` SIN `stripe_subscription_id`): así ninguna de las
 * 4 rutas necesita llamar a Stripe ni siquiera en el camino feliz, y este archivo puede
 * probar el GATE sin doblar el gateway. Las env de Stripe igual se stubbean porque `checkout`
 * valida la configuración antes de decidir.
 */
const ROUTES: [
  string,
  (r: ReturnType<typeof billingRequest>) => Promise<Response>,
  unknown,
][] = [
  ["checkout", CHECKOUT, { interval: "month" }],
  ["cancel", CANCEL, {}],
  ["interval", INTERVAL, { to: "year" }],
  ["settle-free", SETTLE_FREE, {}],
];

async function signIn(email: string, password: string): Promise<string> {
  const response = await getMerchantAuth().api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  expect(response.status).toBe(200);
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

const PASSWORD = "supersecret-integration";

/** Crea un miembro con contraseña real y devuelve su cookie de sesión. `promote` lo convierte
 * en owner por SQL, y `status` lo deja activo o desactivado. */
async function member(
  business: Seed["business"],
  opts: { role: "owner" | "staff"; status: "active" | "disabled" },
): Promise<{ cookie: string; userId: string }> {
  const email = `billing-gate-${randomUUID()}@example.test`;
  const staff = await createStaff(business, {
    name: "Gate",
    email,
    password: PASSWORD,
  });
  if (opts.role === "owner") {
    await getDb()
      .update(memberships)
      .set({ role: "owner" })
      .where(
        and(
          eq(memberships.businessId, business.id),
          eq(memberships.userId, staff.userId),
        ),
      );
  }
  if (opts.status === "disabled") {
    // Un owner no se puede desactivar por `setStaffStatus` (409), y es justo el caso que hay
    // que probar: se desactiva por SQL, que es el estado que `ownerContext` filtra.
    if (opts.role === "owner") {
      await getDb()
        .update(memberships)
        .set({ status: "disabled" })
        .where(
          and(
            eq(memberships.businessId, business.id),
            eq(memberships.userId, staff.userId),
          ),
        );
    } else {
      await setStaffStatus(business, staff.userId, "disabled");
    }
  }
  // La sesión se abre DESPUÉS de desactivar: `setStaffStatus` revoca las sesiones vivas, así
  // que una cookie sacada antes daría 401 y el test estaría midiendo otra cosa.
  return { cookie: await signIn(email, PASSWORD), userId: staff.userId };
}

describe.skipIf(!integrationEnabled)(
  "api/billing — el gate con sesiones REALES (spec 0063, D6)",
  () => {
    let seed: Seed;

    beforeAll(async () => {
      seed = await seedBillingBusiness("plus", { interval: "month" });
    }, 60_000);

    afterAll(async () => {
      await dropBusiness(seed.business.id);
    }, 30_000);

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    function stubEnv() {
      for (const [name, value] of stripeEnvEntries()) vi.stubEnv(name, value);
      vi.stubEnv("MERCHANT_PUBLIC_ORIGIN", "https://checkpass.test");
    }

    it("sin cookie, las 5 rutas responden 401", async () => {
      stubEnv();
      for (const [name, handler, body] of ROUTES) {
        const response = await handler(billingRequest(body));
        expect(response.status, name).toBe(401);
      }
      expect((await readSubscriptionRow(seed.business.id)).plan).toBe("plus");
    }, 60_000);

    it.each([
      ["staff ACTIVO", "staff", "active"],
      ["staff DESACTIVADO", "staff", "disabled"],
      ["owner DESACTIVADO", "owner", "disabled"],
    ] as const)(
      "un %s recibe 403 en las 5 rutas y no toca la suscripción",
      async (_label, role, status) => {
        stubEnv();
        const { cookie } = await member(seed.business, { role, status });
        expect(cookie).toContain("session_token");
        for (const [name, handler, body] of ROUTES) {
          // El body GRITA el negocio del caller a propósito: el gate viejo —«existe fila en
          // `memberships` para ESE negocio»— lo habría aceptado, porque un staff SÍ tiene
          // fila. Es lo que hace que la mutación M6 muerda acá sobre la propiedad y no sobre
          // un uuid vacío.
          const request = billingRequest(
            { ...(body as object), businessId: seed.business.id },
            { cookie },
          );
          const response = await handler(request);
          expect(response.status, name).toBe(403);
          expect(await response.json(), name).toEqual({
            error: "Solo el owner puede gestionar la suscripción.",
          });
        }
        // El dominio no se tocó: el plan sigue donde estaba.
        expect((await readSubscriptionRow(seed.business.id)).plan).toBe("plus");
      },
      120_000,
    );

    /**
     * CONTROL POSITIVO, y no es decorativo: sin él, una cookie mal construida daría 401 en
     * todos los casos de arriba… que igual no son 403, así que el test se pondría rojo. Lo
     * que este control agrega es que la sesión que el harness fabrica SÍ pasa el gate, o sea
     * que los 403 de arriba son del ROL y no del transporte.
     */
    it("un owner ACTIVO pasa el gate en las 5 rutas (ni 401 ni 403)", async () => {
      stubEnv();
      const { cookie } = await member(seed.business, {
        role: "owner",
        status: "active",
      });
      for (const [name, handler, body] of ROUTES) {
        const response = await handler(
          billingRequest(
            { ...(body as object), businessId: seed.business.id },
            { cookie },
          ),
        );
        expect([401, 403], `${name} → ${response.status}`).not.toContain(
          response.status,
        );
      }
    }, 120_000);
  },
);
