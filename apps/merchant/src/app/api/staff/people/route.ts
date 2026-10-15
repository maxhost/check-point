import { NextResponse } from "next/server";
import {
  createStaffPerson,
  listStaffPeople,
} from "../../../../server/staff-people";
import { peopleBody, requireStaffAccess, staffError } from "./_shared";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireStaffAccess(request);
    if ("response" in auth) return auth.response;
    const people = await listStaffPeople(
      auth.business,
      new URL(request.url).searchParams.get("month"),
    );
    return NextResponse.json({ people });
  } catch (error) {
    return staffError(error, "No pudimos listar el equipo.");
  }
}
export async function POST(request: Request) {
  try {
    const auth = await requireStaffAccess(request);
    if ("response" in auth) return auth.response;
    const result = await createStaffPerson(
      auth.business,
      { userId: auth.userId, role: auth.role },
      await peopleBody(request),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return staffError(error, "No pudimos crear a la persona.");
  }
}
