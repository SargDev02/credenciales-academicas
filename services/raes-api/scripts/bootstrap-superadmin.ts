import { config } from "dotenv";
import { z } from "zod";

import { getRaesSupabaseAdmin } from "../src/lib/supabase-admin";

config({ path: ".env.local" });

const bootstrapSchema = z.object({
  RAES_BOOTSTRAP_ADMIN_EMAIL: z.string().email(),
  RAES_BOOTSTRAP_ADMIN_PASSWORD: z.string().min(10),
  RAES_BOOTSTRAP_ADMIN_NOMBRES: z.string().trim().min(1).max(120),
  RAES_BOOTSTRAP_ADMIN_APELLIDOS: z.string().trim().min(1).max(120),
});

async function findUserByEmail(email: string) {
  const supabase = getRaesSupabaseAdmin();
  let page = 1;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw new Error(
        `No fue posible consultar usuarios RAES Auth: ${error.message}`,
      );
    }

    const user = data.users.find(
      (candidate) =>
        candidate.email?.toLowerCase() === email.toLowerCase(),
    );

    if (user) {
      return user;
    }

    if (data.users.length < 100) {
      return null;
    }

    page += 1;
  }

  throw new Error(
    "Se alcanzó el límite de búsqueda de usuarios durante el bootstrap",
  );
}

async function main() {
  const parsed = bootstrapSchema.safeParse(process.env);

  if (!parsed.success) {
    const invalid = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean);

    throw new Error(
      `Configuración incompleta del bootstrap: ${invalid.join(", ")}`,
    );
  }

  const input = parsed.data;
  const supabase = getRaesSupabaseAdmin();

  const { data: existingSuperadmin, error: superadminError } =
    await supabase
      .from("perfiles_admin")
      .select("id,nombres,apellidos,rol,estado")
      .eq("rol", "SUPERADMIN")
      .eq("estado", "ACTIVO")
      .limit(1)
      .maybeSingle();

  if (superadminError) {
    throw new Error(
      `No fue posible verificar SUPERADMIN existente: ${superadminError.message}`,
    );
  }

  if (existingSuperadmin) {
    console.log("");
    console.log("RAES ya tiene un SUPERADMIN activo.");
    console.log(
      "El bootstrap inicial queda bloqueado para evitar elevaciones accidentales de privilegios.",
    );
    return;
  }

  let user = await findUserByEmail(
    input.RAES_BOOTSTRAP_ADMIN_EMAIL,
  );

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: input.RAES_BOOTSTRAP_ADMIN_EMAIL,
      password: input.RAES_BOOTSTRAP_ADMIN_PASSWORD,
      email_confirm: true,
    });

    if (error || !data.user) {
      throw new Error(
        `No fue posible crear el usuario administrativo: ${error?.message ?? "respuesta vacía"}`,
      );
    }

    user = data.user;
  }

  const { error: profileError } = await supabase
    .from("perfiles_admin")
    .upsert(
      {
        id: user.id,
        nombres: input.RAES_BOOTSTRAP_ADMIN_NOMBRES,
        apellidos: input.RAES_BOOTSTRAP_ADMIN_APELLIDOS,
        rol: "SUPERADMIN",
        estado: "ACTIVO",
      },
      {
        onConflict: "id",
      },
    );

  if (profileError) {
    throw new Error(
      `No fue posible crear el perfil SUPERADMIN: ${profileError.message}`,
    );
  }

  console.log("");
  console.log("RAES — Bootstrap SUPERADMIN completado");
  console.log("-------------------------------------");
  console.log(`Email: ${input.RAES_BOOTSTRAP_ADMIN_EMAIL}`);
  console.log(`User ID: ${user.id}`);
  console.log("Rol: SUPERADMIN");
  console.log("Estado: ACTIVO");
  console.log("");
  console.log(
    "La contraseña no se imprime ni se persiste fuera de Supabase Auth.",
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Error inesperado durante el bootstrap",
  );
  process.exitCode = 1;
});
