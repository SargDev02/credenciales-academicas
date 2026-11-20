import { operationalLog } from "@raes/web-core/observability";
import { getRaesSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getRaesSupabaseAdmin();

    const authResult=await supabase.auth.admin.listUsers({page:1,perPage:1});
    const { error } = await supabase
      .from("instituciones")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    const authUp=!authResult.error && Array.isArray(authResult.data.users);
    if (error || !authUp) {
      operationalLog("raes-api","DEPENDENCY_DOWN");

      return Response.json(
        {
          status: "not_ready",
          service: "raes-api",
          components: {
            database: error ? "down" : "up",
            auth: authUp ? "up" : "down",
          },
        },
        { status: 503 },
      );
    }

    return Response.json({
      status: "ready",
      service: "raes-api",
      components: {
        database: "up",
        auth: "up",
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    operationalLog("raes-api","DEPENDENCY_DOWN");

    return Response.json(
      {
        status: "not_ready",
        service: "raes-api",
        components: {
          configuration: "invalid",
        },
      },
      { status: 503 },
    );
  }
}
