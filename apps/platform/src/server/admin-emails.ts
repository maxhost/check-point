/**
 * Spec 0190 §D2 (ADR 0135 §2): quien entra al panel lo decide `PLATFORM_ADMIN_EMAILS` (correos
 * separados por coma), no la base. Sin variable o vacia → nadie (fail-closed). Se lee en CADA
 * llamada: sacar un correo de la variable corta el acceso en el proximo request.
 */
export function adminEmails(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return (env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(
  email: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return adminEmails(env).includes(email.trim().toLowerCase());
}
