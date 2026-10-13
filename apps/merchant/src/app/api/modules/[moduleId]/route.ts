import { putModule } from "../../../../modules/toggle-route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ moduleId: string }> };

/** `PUT /api/modules/:moduleId` — `{ enabled }` → `200 { module }`. Solo el owner (ADR 0138 §4).
 * Un modulo con ruta base propia (`recipes`) lo atiende su `route.ts`: ver `modules/toggle-route.ts`. */
export async function PUT(request: Request, { params }: Params) {
  const { moduleId } = await params;
  return putModule(request, moduleId);
}
