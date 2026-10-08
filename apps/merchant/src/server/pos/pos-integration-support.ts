import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import {
  conCookie,
  cookieDe,
  permisosIntegrationEnabled,
} from "../permissions-integration-support";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
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
} from "../counter/coupon-cycle-support";
import { seedMember } from "../counter-integration-support";
import { GET as LIST, POST as CREATE } from "../../app/api/pos/orders/route";
import {
  GET as READ,
  PUT as UPDATE,
} from "../../app/api/pos/orders/[id]/route";
import { POST as VOID } from "../../app/api/pos/orders/[id]/void/route";
import { POST as CLOSE } from "../../app/api/pos/orders/[id]/close/route";
import { PUT as SET_MODULE } from "../../app/api/merchant/business/pos/route";

/**
 * Spec 0169 — EL MUNDO DEL POS para las suites `pos-*.neon.integration`: el mundo del cupon
 * elegido (`coupon-cycle-support.ts`: forma de PRODUCCION, puntos 10 por 1.00, dos productos,
 * Bienvenida que emite cupones) con el modulo POS ENCENDIDO y la cookie de una sesion REAL del
 * owner. Las rutas se llaman como las llama el navegador: con cookie, sin dobles.
 * Aca no hay un solo `expect`: los oraculos viven en los tests.
 */

export const posIntegrationEnabled = permisosIntegrationEnabled;

export type PosWorld = CycleWorld & {
  ownerCookie: string;
  extraUsers: string[];
};

export async function setPosModule(
  businessId: string,
  enabled: boolean,
): Promise<void> {
  await getDb()
    .update(businesses)
    .set({ posEnabled: enabled })
    .where(eq(businesses.id, businessId));
}

export async function seedPosWorld(label: string): Promise<PosWorld> {
  const world = await seedCycleWorld(label);
  await setPosModule(world.seed.business.id, true);
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

/** `core.pos_order.order_id` apunta a `core.order` sin cascada: las ordenes del POS se borran
 * ANTES que el mundo (que borra las `core.order`). */
export async function dropPosWorld(world: PosWorld | undefined): Promise<void> {
  if (!world) return;
  await getDb()
    .delete(posOrders)
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

const params = (id: string) => ({ params: Promise.resolve({ id }) });

/** Las rutas del POS, con la cookie del caller. Devuelven el `Response` crudo. */
export const pos = {
  list: (cookie: string) => LIST(conCookie("/api/pos/orders", "GET", cookie)),
  create: (cookie: string, body: unknown) =>
    CREATE(conCookie("/api/pos/orders", "POST", cookie, body)),
  read: (cookie: string, id: string) =>
    READ(conCookie(`/api/pos/orders/${id}`, "GET", cookie), params(id)),
  update: (cookie: string, id: string, body: unknown) =>
    UPDATE(conCookie(`/api/pos/orders/${id}`, "PUT", cookie, body), params(id)),
  void: (cookie: string, id: string) =>
    VOID(
      conCookie(`/api/pos/orders/${id}/void`, "POST", cookie, {}),
      params(id),
    ),
  close: (cookie: string, id: string, body: unknown) =>
    CLOSE(
      conCookie(`/api/pos/orders/${id}/close`, "POST", cookie, body),
      params(id),
    ),
  setModule: (cookie: string, enabled: boolean) =>
    SET_MODULE(
      conCookie("/api/merchant/business/pos", "PUT", cookie, { enabled }),
    ),
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
