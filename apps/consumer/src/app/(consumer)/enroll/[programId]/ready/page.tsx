import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEnrollLanding } from "@mi-pasaporte/domain/server/consumer/enrollment";
import {
  SESSION_COOKIE,
  walletManifestPathFor,
} from "@mi-pasaporte/domain/server/consumer/core";
import { resolveSession } from "@mi-pasaporte/domain/server/consumer/session";
import { EnrollConfirmation } from "../enroll-confirmation";
import styles from "../../../consumer-entry.module.css";

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
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const [account, landing] = await Promise.all([
    enrollmentAccount(),
    getEnrollLanding(programId),
  ]);
  if (!account) redirect(`/enroll/${encodeURIComponent(programId)}`);
  if (!landing) redirect("/wallet");

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <EnrollConfirmation
          firstName={account.firstName}
          businessName={landing.businessName}
          welcomeOffer={landing.welcomeOffer}
        />
      </div>
    </main>
  );
}
