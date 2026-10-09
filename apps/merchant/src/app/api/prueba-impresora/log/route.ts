import { NextResponse } from "next/server";

/**
 * Bitacora de la pagina publica `/prueba-impresora` (PARQUEADO #84): cada paso que hace quien
 * prueba llega aca y sale como UNA linea en el log del servidor, para diagnosticar a distancia.
 * Es PUBLICA y sin sesion como la pagina, asi que no toca la base, recorta el cuerpo y copia
 * solo campos conocidos. Se borra junto con la pagina.
 */
const MAX_BODY = 4000;
const FIELDS = [
  "session",
  "event",
  "chrome",
  "ua",
  "detail",
  "error",
  "device",
  "service",
] as const;

export async function POST(request: Request) {
  const raw = (await request.text().catch(() => "")).slice(0, MAX_BODY);
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") body = parsed as typeof body;
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const entry: Record<string, string> = { at: new Date().toISOString() };
  for (const field of FIELDS) {
    const value = body[field];
    if (value !== undefined && value !== null)
      entry[field] = String(
        typeof value === "object" ? JSON.stringify(value) : value,
      ).slice(0, 1000);
  }
  console.log("[PRUEBA-IMPRESORA]", JSON.stringify(entry));
  return new NextResponse(null, { status: 204 });
}
