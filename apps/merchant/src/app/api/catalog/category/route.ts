import { NextResponse } from "next/server";
import { createCategory } from "../../../../server/catalog";
import { catalogError, readJson, requireOwner } from "../_auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const category = await createCategory(
      auth.business,
      await readJson(request),
    );
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return catalogError(error, "No pudimos crear la categoría.");
  }
}
