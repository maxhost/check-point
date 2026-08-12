export const runtime = "nodejs";

export function GET(): Response {
  return Response.json({ service: "merchant", status: "ok" });
}
