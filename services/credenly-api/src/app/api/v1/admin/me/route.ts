import { administrativeRead } from "@/lib/admin-audit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return administrativeRead(
    request,
    "ADMIN_PROFILE_READ",
    "ADMIN_PROFILE",
    async (profile) => profile,
  );
}
