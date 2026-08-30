import { requireOwner } from "../../../server/auth-guards";
import { listStaff } from "../../../server/staff";
import { StaffConsole } from "./staff-console";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const { business } = await requireOwner();
  const staff = await listStaff(business.id);
  return <StaffConsole initialStaff={staff} />;
}
