import { randomUUID } from "node:crypto";
import { afterAll, beforeAll } from "vitest";

import {
  seedPosWorld,
  dropPosWorld,
  openOrder,
  pos,
  type PosWorld,
} from "./pos-integration-support";

import { businessHttp } from "../../../server/business/http";

export let world: PosWorld, other: PosWorld;
const flag = process.env.MODULE_EVENTS_ENABLED;
const req = (
  path: string,
  method = "GET",
  body?: unknown,
  cookie = world.ownerCookie,
) =>
  new Request("http://localhost:3001/api/business/" + path, {
    method,
    headers: { cookie, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
export const api = (
  path: string,
  method = "GET",
  body?: unknown,
  cookie = world.ownerCookie,
) =>
  businessHttp(
    req(path, method, body, cookie),
    path.split("?", 1)[0].split("/"),
  );
export async function close(
  methodId: string,
  amount = "2.00",
  extra: Record<string, unknown> = {},
) {
  const order = await openOrder(world, [
    { productId: world.cafe, quantity: 1 },
  ]);
  const body = {
    clientRequestId: randomUUID(),
    version: order.version,
    payments: [{ methodId, amount }],
    ...extra,
  };
  const response = await pos.close(world.ownerCookie, order.id, body);
  return { order, body, response };
}
export function setupBusinessWorld() {
  beforeAll(async () => {
    world = await seedPosWorld("N core");
    other = await seedPosWorld("N other");
    process.env.MODULE_EVENTS_ENABLED = "false";
  }, 240000);
  afterAll(async () => {
    if (flag === undefined) delete process.env.MODULE_EVENTS_ENABLED;
    else process.env.MODULE_EVENTS_ENABLED = flag;
    await dropPosWorld(world);
    await dropPosWorld(other);
  }, 240000);
}
