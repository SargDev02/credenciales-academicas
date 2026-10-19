import { administrativeRead } from "@/lib/admin-audit";
import { getAuthAccounts } from "@/lib/admin-operations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return administrativeRead(
    request,
    "AUTH_ACCOUNTS_READ",
    "AUTH_ACCOUNTS",
    () => getAuthAccounts(request),
  );
}
