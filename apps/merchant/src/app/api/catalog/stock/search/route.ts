import { NextResponse } from "next/server";
import {
  StockError,
  getStockProvider,
} from "../../../../../server/stock/provider";
import { requireOwner } from "../../_auth";

export const runtime = "nodejs";

/** Server-proxied stock search: the provider API key never reaches the client. */
export async function GET(request: Request) {
  const auth = await requireOwner(request);
  if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const page = Number(url.searchParams.get("page") ?? "1");
  try {
    const provider = await getStockProvider();
    const photos = await provider.search(q, Number.isFinite(page) ? page : 1);
    return NextResponse.json({ provider: provider.id, photos });
  } catch (error) {
    if (error instanceof StockError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "No pudimos buscar imágenes." },
      { status: 502 },
    );
  }
}
