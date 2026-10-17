import { businessHttp } from "../../../../server/business/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
const handle = async (request: Request, context: Context) =>
  businessHttp(request, (await context.params).path);
export { handle as GET, handle as POST, handle as PUT };
