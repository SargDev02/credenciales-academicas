import { getRaesSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getRaesSupabaseAdmin();

    const { error } = await supabase
      .from("instituciones")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    if (error) {
      console.error("RAES database readiness check failed", {
        code: error.code,
      });

      return Response.json(
        {
          status: "not_ready",
          service: "raes-api",
          components: {
            database: "down",
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
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("RAES readiness configuration failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });

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
