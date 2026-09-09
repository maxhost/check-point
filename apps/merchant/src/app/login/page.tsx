import { LoginForm } from "./login-form";
import { loginNotice } from "./login-notice";

/**
 * Server component so the page can read why the guard bounced the visitor
 * (`/login?e=…`, ADR 0055) and hand the copy to the client form. `searchParams` is a
 * Promise in this Next version (see node_modules/next/dist/docs, page.js reference).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string | string[] }>;
}) {
  const { e } = await searchParams;
  return <LoginForm initialError={loginNotice(e)} />;
}
