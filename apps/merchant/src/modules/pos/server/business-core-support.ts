import { randomUUID } from "node:crypto";
import { afterAll, beforeAll } from "vitest";

import {
  seedPosWorld,
  dropPosWorld,
  openOrder,
  openOrderV2,
  capturePosScope,
  scopedPos,
  pos,
  type PosWorld,
} from "./pos-integration-support";

import { businessHttp } from "../../../server/business/http";

export let world: PosWorld, other: PosWorld;
export let worldScope: string | undefined;
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
  const items = [{ productId: world.cafe, quantity: 1 }];
  const order =
    worldScope === undefined
      ? await openOrder(world, items)
      : await openOrderV2(world, worldScope, items);
  const body = {
    clientRequestId: randomUUID(),
    version: order.version,
    payments: [{ methodId, amount }],
    ...extra,
  };
  const response =
    worldScope === undefined
      ? await pos.close(world.ownerCookie, order.id, body)
      : await scopedPos(world.ownerCookie, worldScope).close(order.id, body);
  return { order, body, response };
}
export function setupBusinessWorld(options?: { posContract: 2 }) {
  beforeAll(async () => {
    world = await seedPosWorld("N core");
    other = await seedPosWorld("N other");
    worldScope =
      options?.posContract === 2
        ? await capturePosScope(world.ownerCookie, world.seed.business.id)
        : undefined;
  }, 240000);
  afterAll(async () => {
    await dropPosWorld(world);
    await dropPosWorld(other);
  }, 240000);
}
