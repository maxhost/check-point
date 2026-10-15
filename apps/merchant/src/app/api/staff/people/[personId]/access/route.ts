import { NextResponse } from "next/server";
import { setStaffPersonAccess } from "../../../../../../server/staff-people";
import { peopleBody, requireStaffAccess, staffError } from "../../_shared";
export const dynamic = "force-dynamic";
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  try {
    const auth = await requireStaffAccess(request);
    if ("response" in auth) return auth.response;
    const { personId } = await params;
    const result = await setStaffPersonAccess(
      auth.business,
      { userId: auth.userId, role: auth.role },
      personId,
      await peopleBody(request),
    );
    return NextResponse.json(result);
  } catch (error) {
    return staffError(error, "No pudimos cambiar el acceso.");
  }
}
