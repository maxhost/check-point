import { NextResponse } from "next/server";
import { updateCurrency } from "../../../../server/catalog";
import { catalogError, readJson, requireOwner } from "../_auth";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  const auth = await requireOwner(request);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json(
      await updateCurrency(auth.business, await readJson(request)),
    );
  } catch (error) {
    return catalogError(error, "No pudimos actualizar la moneda.");
  }
}
