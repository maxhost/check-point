import { cardPOST } from "../../../../../../server/analytics/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return cardPOST(request, (await context.params).id, "dismissed");
}
