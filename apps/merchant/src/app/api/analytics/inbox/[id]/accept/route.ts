import { legacyCardPOST } from "../../../../../../server/analytics/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return legacyCardPOST(request, (await context.params).id);
}
