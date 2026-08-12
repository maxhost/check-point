import { toNextJsHandler } from "better-auth/next-js";
import { getMerchantAuth } from "../../../../server/auth";

function handler() {
  return toNextJsHandler(getMerchantAuth());
}

export async function GET(request: Request) {
  return handler().GET(request);
}

export async function POST(request: Request) {
  return handler().POST(request);
}
