import { authenticateAdmin, adminAuthErrorResponse } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let response: Response;
  try {
    const { profile } = await authenticateAdmin(request, [
      "SUPERADMIN",
      "ADMIN",
      "AUDITOR",
    ]);
    // Explicit projection: never serialize the Auth user or future profile fields.
    response = Response.json({
      data: {
        id: profile.id,
        nombres: profile.nombres,
        apellidos: profile.apellidos,
        rol: profile.rol,
        estado: profile.estado,
      },
    });
  } catch (error) {
    response = adminAuthErrorResponse(error);
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
