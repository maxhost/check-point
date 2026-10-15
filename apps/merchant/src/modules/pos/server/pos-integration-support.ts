import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import {
  cookieDe,
  permisosIntegrationEnabled,
} from "../../../server/permissions-integration-support";
import { initializePaymentMethods } from "./payment-catalog";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  businessModules,
  orderItems,
  orders,
  posOrders,
  products,
  users,
  walletPushQueue,
} from "@mi-pasaporte/db/schema";
import {
  type CycleWorld,
  dropCycleWorld,
  seedCycleWorld,
} from "../../../server/counter/coupon-cycle-support";
import { seedMember } from "../../../server/counter-integration-support";
import { callModuleRoute } from "../../modules-integration-support";

/**
 * Spec 0169 — EL MUNDO DEL POS para las suites `pos-*.neon.integration`: el mundo del cupon
 * elegido (`coupon-cycle-support.ts`: forma de PRODUCCION, puntos 10 por 1.00, dos productos,
 * Bienvenida que emite cupones) con el modulo POS ENCENDIDO y la cookie de una sesion REAL del
 * owner. Las rutas se llaman como las llama el navegador: con cookie, sin dobles.
 * Aca no hay un solo `expect`: los oraculos viven en los tests.
 *
 * Spec 0220: las rutas son las del despachador (`/api/modules/pos/…`, `callModuleRoute`) y el
 * modulo se enciende en `core.business_module` (montaje por SQL; Mesas, solo si el caso lo pide).
 */

export const posIntegrationEnabled = permisosIntegrationEnabled;

export type PosWorld = CycleWorld & {
  ownerCookie: string;
  extraUsers: string[];
};

/** Enciende o apaga un modulo POR SQL (montaje: el camino por la ruta lo prueba cada suite). */
export async function setModuleRow(
  businessId: string,
  moduleId: string,
  enabled: boolean,
): Promise<void> {
  await getDb()
    .insert(businessModules)
    .values({ businessId, moduleId, enabled })
    .onConflictDoUpdate({
      target: [businessModules.businessId, businessModules.moduleId],
      set: { enabled },
    });
}

export async function setPosModule(
  businessId: string,
  enabled: boolean,
): Promise<void> {
  await setModuleRow(businessId, "pos", enabled);
}

export async function seedPosWorld(
  label: string,
  countryCode = "EC",
  currencyCode = "USD",
): Promise<PosWorld> {
  const world = await seedCycleWorld(label);
  await getDb()
    .update(businesses)
    .set({ countryCode, currencyCode })
    .where(eq(businesses.id, world.seed.business.id));
  world.seed.business.currencyCode = currencyCode;
  await setPosModule(world.seed.business.id, true);
  await withDbTransaction((tx) =>
    initializePaymentMethods(tx, { businessId: world.seed.business.id }),
  );
  return {
    ...world,
    ownerCookie: await cookieDe(world.seed.userId),
    extraUsers: [],
  };
}

/** Un integrante con `permissions` y su cookie. El seed escribe la fila directo (no pasa por el
 * writer de permisos), que es lo que deja sembrar `pos` aunque el modulo este apagado. */
export async function posStaff(
  world: PosWorld,
  permissions: string[],
): Promise<{ userId: string; cookie: string }> {
  const userId = await seedMember({
    businessId: world.seed.business.id,
    permissions,
  });
  world.extraUsers.push(userId);
  return { userId, cookie: await cookieDe(userId) };
}

/** Cut the test's accreditation reference before legacy cleanup; immutable payments only
 * cascade when the aggregate root disappears, after orders and consumer memberships. */
export async function dropPosWorld(world: PosWorld | undefined): Promise<void> {
  if (!world) return;
  await getDb()
    .update(posOrders)
    .set({ orderId: null })
    .where(eq(posOrders.businessId, world.seed.business.id));
  await dropCycleWorld(world);
  if (world.extraUsers.length > 0)
    await getDb().delete(users).where(inArray(users.id, world.extraUsers));
}

/** Un producto propio del caso (para cambiarle el precio o borrarlo sin tocar a los demas). */
export async function seedProduct(
  world: PosWorld,
  name: string,
  unitPrice: string | null,
): Promise<string> {
  const [row] = await getDb()
    .insert(products)
    .values({
      businessId: world.seed.business.id,
      name,
      unitPrice,
      availableAllLocations: true,
    })
    .returning({ id: products.id });
  return row.id;
}

const POS = "/api/modules/pos";

/** Las rutas del POS, con la cookie del caller. Devuelven el `Response` crudo. */
export const pos = {
  list: (cookie: string) => callModuleRoute("GET", `${POS}/orders`, cookie),
  create: (cookie: string, body: unknown) =>
    callModuleRoute("POST", `${POS}/orders`, cookie, body),
  read: (cookie: string, id: string) =>
    callModuleRoute("GET", `${POS}/orders/${id}`, cookie),
  update: (cookie: string, id: string, body: unknown) =>
    callModuleRoute("PUT", `${POS}/orders/${id}`, cookie, body),
  void: (cookie: string, id: string) =>
    callModuleRoute("POST", `${POS}/orders/${id}/void`, cookie, {}),
  close: (cookie: string, id: string, body: unknown) =>
    callModuleRoute("POST", `${POS}/orders/${id}/close`, cookie, body),
  catalog: (cookie: string, locationId?: string) =>
    callModuleRoute(
      "GET",
      locationId ? `${POS}/catalog?locationId=${locationId}` : `${POS}/catalog`,
      cookie,
    ),
  tables: (cookie: string, locationId: string) =>
    callModuleRoute("GET", `${POS}/tables?locationId=${locationId}`, cookie),
  ticket: (cookie: string) => callModuleRoute("GET", `${POS}/ticket`, cookie),
  ticketSettings: (cookie: string) =>
    callModuleRoute("GET", `${POS}/ticket-settings`, cookie),
  saveTicketSettings: (cookie: string, body: unknown) =>
    callModuleRoute("PUT", `${POS}/ticket-settings`, cookie, body),
  /** El toggle GENERICO del core (`PUT /api/modules/<id>`), para el POS o Mesas. */
  setModule: (cookie: string, enabled: boolean, moduleId = "pos") =>
    callModuleRoute("PUT", `/api/modules/${moduleId}`, cookie, { enabled }),
};

/** Crea una orden por la ruta y devuelve su cuerpo (falla ruidoso si no es 201). */
export async function openOrder(
  world: PosWorld,
  items: { productId: string; quantity: number; unitPrice?: string }[],
  tableLabel = `Mesa ${randomUUID().slice(0, 4)}`,
) {
  const response = await pos.create(world.ownerCookie, {
    tableLabel,
    locationId: world.seed.locationId,
    items,
  });
  if (response.status !== 201)
    throw new Error(`openOrder: ${response.status} ${await response.text()}`);
  return response.json();
}

/** La fila de la orden del POS, LEIDA POR SQL (la respuesta de la API no es el oraculo). */
export async function posRow(id: string) {
  const [row] = await getDb()
    .select({
      status: posOrders.status,
      version: posOrders.version,
      orderId: posOrders.orderId,
      closeRequestId: posOrders.closeRequestId,
    })
    .from(posOrders)
    .where(eq(posOrders.id, id));
  return row;
}

/** Las `core.order` de un consumidor con sus lineas, por SQL, para comparar POS vs mostrador. */
export async function ordersWithItems(businessId: string, consumerId: string) {
  const rows = await getDb()
    .select({
      id: orders.id,
      mode: orders.mode,
      total: orders.total,
      note: orders.note,
      locationId: orders.locationId,
      unitsGranted: orders.unitsGranted,
      balanceAfter: orders.balanceAfter,
    })
    .from(orders)
    .where(
      sql`${orders.businessId} = ${businessId} and ${orders.consumerId} = ${consumerId}`,
    );
  const items = rows.length
    ? await getDb()
        .select({
          orderId: orderItems.orderId,
          productId: orderItems.productId,
          nameSnapshot: orderItems.nameSnapshot,
          unitPrice: orderItems.unitPriceSnapshot,
          quantity: orderItems.quantity,
          lineTotal: orderItems.lineTotal,
        })
        .from(orderItems)
        .where(
          inArray(
            orderItems.orderId,
            rows.map((row) => row.id),
          ),
        )
    : [];
  return rows.map((row) => ({
    ...row,
    items: items
      .filter((item) => item.orderId === row.id)
      .map((item) => ({
        productId: item.productId,
        nameSnapshot: item.nameSnapshot,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      }))
      .sort((a, b) => a.nameSnapshot.localeCompare(b.nameSnapshot)),
  }));
}

/** Los push transaccionales encolados para un consumidor (la cola que llena `persistGrant`). */
export async function pushesOf(consumerId: string) {
  return getDb()
    .select({ class: walletPushQueue.class, body: walletPushQueue.body })
    .from(walletPushQueue)
    .where(eq(walletPushQueue.consumerId, consumerId));
}
