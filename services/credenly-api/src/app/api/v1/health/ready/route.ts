import { getRaesClientIdentity } from "@/lib/raes-client";
import { getCredenlySupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getCredenlySupabaseAdmin();

    const [databaseResult, authResult, raesResult] = await Promise.allSettled([
      supabase
        .from("perfiles")
        .select("id", { head: true, count: "exact" })
        .limit(1),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
      getRaesClientIdentity(),
    ]);

    const databaseUp =
      databaseResult.status === "fulfilled" &&
      !databaseResult.value.error;
    const authUp = authResult.status === "fulfilled" && !authResult.value.error && Array.isArray(authResult.value.data.users);
    const raesUp = raesResult.status === "fulfilled";

    if (!databaseUp || !authUp || !raesUp) {
      if (
        databaseResult.status === "fulfilled" &&
        databaseResult.value.error
      ) {
        console.error("Credenly database readiness failed", {
          code: databaseResult.value.error.code,
        });
      }

      if (raesResult.status === "rejected") {
        console.error("Credenly RAES readiness failed");
      }

      return Response.json(
        {
          status: "not_ready",
          service: "credenly-api",
          components: {
            database: databaseUp ? "up" : "down",
            auth: authUp ? "up" : "down",
            raes: raesUp ? "up" : "down",
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
        auth: authUp ? "up" : "down",
        raes: "up",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Credenly readiness configuration failed");

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
