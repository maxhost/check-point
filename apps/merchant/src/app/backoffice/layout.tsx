import { requireBackofficeSession } from "../../server/auth-guards";
import { BackofficeNavigation } from "./backoffice-navigation";

export default async function BackofficeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireBackofficeSession();

  return (
    <div className="backoffice-layout">
      <BackofficeNavigation
        businessName={session.business.name}
        isOwner={session.membership.role === "owner"}
      />
      <div className="backoffice-content">{children}</div>
    </div>
  );
}
