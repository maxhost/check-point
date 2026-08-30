import { NextResponse } from "next/server";
import { createStaff } from "../../../server/staff";
import { requireStaffOwner, staffError } from "./_auth";

export const dynamic = "force-dynamic";

/** POST /api/staff — owner creates a staff member (name, email, password ≥ 8). */
export async function POST(request: Request) {
  const auth = await requireStaffOwner(request);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo no es válido." },
      { status: 400 },
    );
  }

  try {
    const staff = await createStaff(auth.business, body);
    return NextResponse.json({ staff }, { status: 201 });
  } catch (error) {
    return staffError(error, "No pudimos crear al integrante.");
  }
}
