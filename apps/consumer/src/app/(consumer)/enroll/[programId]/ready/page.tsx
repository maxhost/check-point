import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEnrollLanding } from "@mi-pasaporte/domain/server/consumer/enrollment";
import {
  SESSION_COOKIE,
  walletManifestPathFor,
} from "@mi-pasaporte/domain/server/consumer/core";
import { resolveSession } from "@mi-pasaporte/domain/server/consumer/session";
import { vapidFromEnv } from "@mi-pasaporte/domain/server/push/vapid";
import { EnrollConfirmation } from "../enroll-confirmation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function enrollmentAccount() {
  const store = await cookies();
  return resolveSession(store.get(SESSION_COOKIE)?.value);
}

export async function generateMetadata(): Promise<Metadata> {
  const account = await enrollmentAccount();
  return account
    ? { manifest: walletManifestPathFor(account.webViewToken) }
    : {};
}

export default async function EnrollReadyPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ existing?: string }>;
}) {
  const { programId } = await params;
  const [account, landing] = await Promise.all([
    enrollmentAccount(),
    getEnrollLanding(programId),
  ]);
  if (!account) redirect(`/enroll/${encodeURIComponent(programId)}`);
  if (!landing) redirect("/wallet");

  return (
    <main
      style={{
        maxWidth: 420,
        margin: "0 auto",
        padding: "32px 20px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <EnrollConfirmation
        firstName={account.firstName}
        businessName={landing.businessName}
        brandPrimaryColor={landing.brandPrimaryColor}
        vapidPublicKey={vapidFromEnv()?.publicKey ?? null}
        walletManifestPath={walletManifestPathFor(account.webViewToken)}
        existingAccount={(await searchParams).existing === "1"}
      />
    </main>
  );
}
