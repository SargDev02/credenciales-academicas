export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok",
    service: "credenly-api",
    timestamp: new Date().toISOString(),
  });
}
