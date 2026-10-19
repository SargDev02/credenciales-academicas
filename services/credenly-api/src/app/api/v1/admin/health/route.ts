import { administrativeRead } from "@/lib/admin-audit";
import { GET as readiness } from "../../health/ready/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return administrativeRead(request, "HEALTH_READ", "HEALTH", async () => {
    const result = await readiness();
    const body = await result.json();
    const components = body.components ?? {};
    return { checkedAt: new Date().toISOString(), httpStatus: result.status, status: body.status === "ready" ? "ready" : "not_ready", components: { database: components.database === "up" ? "up" : "down", auth: components.auth === "configured" ? "configured" : "unavailable", raes: components.raes === "up" ? "up" : "down" } };
  });
}
