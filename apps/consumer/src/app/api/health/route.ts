export const runtime = "nodejs";

export function GET(): Response {
  return Response.json({ service: "consumer", status: "ok" });
}
