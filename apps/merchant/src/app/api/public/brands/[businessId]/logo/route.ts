import { NextResponse } from "next/server";
import {
  getPrivateObject,
  objectBodyToWebStream,
} from "../../../../../../server/r2";
import { logoForPublicBusiness } from "../../../../../../server/brand";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const version = new URL(request.url).searchParams.get("v");
  const webp = request.headers.get("accept")?.includes("image/webp") ?? false;
  try {
    // Inside the try so a regex-valid-but-invalid uuid (Postgres 22P02) becomes a
    // clean 404 instead of a 500.
    const business = await logoForPublicBusiness(businessId, version);
    if (!business) return new NextResponse(null, { status: 404 });
    const object = await getPrivateObject(
      `${business.logoObjectKey}/logo.${webp ? "webp" : "png"}`,
    );
    return new NextResponse(
      objectBodyToWebStream(object.Body as AsyncIterable<Uint8Array>),
      {
        headers: {
          "content-type": webp ? "image/webp" : "image/png",
          "cache-control": "public, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
