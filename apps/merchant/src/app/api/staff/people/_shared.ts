import { StaffError } from "../../../../server/staff-error";
export { requireStaffAccess, staffError } from "../_auth";

export async function peopleBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new StaffError(400, "El cuerpo no es válido.", "invalid_body");
  }
}
