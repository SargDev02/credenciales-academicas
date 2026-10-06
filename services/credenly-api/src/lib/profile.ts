import { z } from "zod";

import { getCredenlySupabaseAdmin } from "./supabase-admin";

export const profileInputSchema = z.object({
  nombres: z.string().trim().min(1).max(160),
  apellidos: z.string().trim().min(1).max(160),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

type ProfileRow = {
  id: string;
  nombres: string | null;
  apellidos: string | null;
  estado: string;
  created_at: string;
  updated_at: string;
};

export async function getProfile(
  userId: string,
): Promise<ProfileRow | null> {
  const supabase = getCredenlySupabaseAdmin();

  const { data, error } = await supabase
    .from("perfiles")
    .select("id,nombres,apellidos,estado,created_at,updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No fue posible consultar el perfil: ${error.code}`,
    );
  }

  return data as ProfileRow | null;
}

export async function upsertProfile(
  userId: string,
  input: ProfileInput,
): Promise<ProfileRow> {
  const supabase = getCredenlySupabaseAdmin();

  const { data, error } = await supabase
    .from("perfiles")
    .upsert(
      {
        id: userId,
        nombres: input.nombres,
        apellidos: input.apellidos,
      },
      {
        onConflict: "id",
      },
    )
    .select("id,nombres,apellidos,estado,created_at,updated_at")
    .single();

  if (error) {
    throw new Error(
      `No fue posible guardar el perfil: ${error.code}`,
    );
  }

  return data as ProfileRow;
}
