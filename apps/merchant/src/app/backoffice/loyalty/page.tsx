import { requireOwner } from "../../../server/auth-guards";
import LoyaltyProgramPage from "./loyalty-page";

export const dynamic = "force-dynamic";

// Owner-only (ADR 0044): a staff member is redirected to the counter console.
export default async function Page() {
  await requireOwner();
  return <LoyaltyProgramPage />;
}
