import { getCredenlySupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getCredenlySupabaseAdmin();

    const { error } = await supabase
      .from("perfiles")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    if (error) {
      console.error("Credenly readiness check failed", {
        code: error.code,
      });

      return Response.json(
        {
          status: "not_ready",
          service: "credenly-api",
          components: {
            database: "down",
          },
        },
        { status: 503 },
      );
    }

    return Response.json({
      status: "ready",
      service: "credenly-api",
      components: {
        database: "up",
        auth: "configured",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Credenly readiness configuration failed", {
      message:
        error instanceof Error ? error.message : "unknown error",
    });

    return Response.json(
      {
        status: "not_ready",
        service: "credenly-api",
        components: {
          configuration: "invalid",
        },
      },
      { status: 503 },
    );
  }
}
