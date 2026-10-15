import { NextResponse } from "next/server";
import { renameStaffPerson } from "../../../../../server/staff-people";
import { peopleBody, requireStaffAccess, staffError } from "../_shared";
export const dynamic = "force-dynamic";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  try {
    const auth = await requireStaffAccess(request);
    if ("response" in auth) return auth.response;
    const { personId } = await params;
    const person = await renameStaffPerson(
      auth.business,
      personId,
      await peopleBody(request),
    );
    return NextResponse.json({ person });
  } catch (error) {
    return staffError(error, "No pudimos actualizar a la persona.");
  }
}
