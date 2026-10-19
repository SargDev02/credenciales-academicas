import { administrativeRead } from "@/lib/admin-audit";
import { getOperationalOverview } from "@/lib/admin-operations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return administrativeRead(
    request,
    "OPERATIONS_READ",
    "OPERATIONS",
    getOperationalOverview,
  );
}
