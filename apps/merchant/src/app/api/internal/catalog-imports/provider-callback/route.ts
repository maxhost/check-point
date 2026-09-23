import { NextResponse } from "next/server";
import { handleProviderCallback } from "../../../../../server/catalog-import";

export const runtime = "nodejs";

/**
 * Spec 0090 §7 — EL CALLBACK DEL PROVEEDOR. **Entrada publica y no autenticada por sesion**:
 * lo unico que la protege es la firma, que se verifica **antes de cualquier otra cosa**.
 *
 * El cuerpo se lee como **texto crudo** y no con `request.json()` a proposito: la firma se
 * calcula sobre los bytes exactos que llegaron, y un `JSON.parse` + `JSON.stringify` de ida y
 * vuelta cambiaria el espaciado y rompería toda firma válida.
 *
 * Un id desconocido responde **200** y se ignora: ni filtra existencia ni deja al proveedor
 * reintentando para siempre.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const outcome = await handleProviderCallback(request.headers, rawBody);
    if (outcome.status === 401) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    return NextResponse.json({ ok: true, result: outcome.result });
  } catch {
    // Un 500 haría que el proveedor reintente; un 200 con `ok:false` deja el rescate en
    // manos del reconciliador, que es quien tiene el lease y el tope de intentos.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
