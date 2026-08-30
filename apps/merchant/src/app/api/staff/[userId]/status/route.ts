import { NextResponse } from "next/server";
import { setStaffStatus } from "../../../../../server/staff";
import { requireStaffOwner, staffError } from "../../_auth";

export const dynamic = "force-dynamic";

/** POST /api/staff/:userId/status — owner activates/deactivates a staff member. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireStaffOwner(request);
  if ("response" in auth) return auth.response;

  const { userId } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "El cuerpo no es válido." },
      { status: 400 },
    );
  }

  try {
    const staff = await setStaffStatus(auth.business, userId, body.status);
    return NextResponse.json({ staff }, { status: 200 });
  } catch (error) {
    return staffError(error, "No pudimos actualizar el estado.");
  }
}
