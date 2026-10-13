import type { Metadata } from "next";
import { WizardShell } from "../[locale]/(merchant)/business/onboarding/_components/merchant-entry";
import { StaffAccess } from "./staff-access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Acceso del equipo | CheckPass Club",
};

export default async function StaffAccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    e?: string | string[];
    "cambiar-pin"?: string | string[];
  }>;
}) {
  const query = await searchParams;
  return (
    <WizardShell audience="Para el equipo">
      <StaffAccess
        changePin={query["cambiar-pin"] === "1"}
        notice={typeof query.e === "string" ? query.e : undefined}
      />
    </WizardShell>
  );
}
