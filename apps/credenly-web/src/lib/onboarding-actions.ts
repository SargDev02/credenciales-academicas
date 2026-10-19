"use server";
import { revalidatePath } from "next/cache";
import { WebApiError } from "@raes/web-core";
import { requireSession } from "./auth";
import { citizenRequest } from "./citizen-api";
import { isProfile, isVerification, isLink } from "./citizen-model";
export type OnboardingResult = { error?: string; message?: string };
export async function updateOnboarding(
  kind: "profile" | "document" | "link",
  form: FormData,
): Promise<OnboardingResult> {
  await requireSession();
  try {
    if (kind === "profile") {
      const nombres = form.get("nombres"),
        apellidos = form.get("apellidos");
      if (
        typeof nombres !== "string" ||
        typeof apellidos !== "string" ||
        !nombres.trim() ||
        !apellidos.trim() ||
        nombres.length > 160 ||
        apellidos.length > 160
      )
        return {
          error:
            "Completa nombres y apellidos (máximo 160 caracteres cada uno).",
        };
      await citizenRequest("/api/v1/profile", isProfile, {
        method: "PUT",
        body: { nombres: nombres.trim(), apellidos: apellidos.trim() },
      });
    } else if (kind === "document") {
      const file = form.get("documento");
      if (
        !(file instanceof File) ||
        !file.size ||
        file.size > 8 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        return {
          error: "Selecciona una imagen JPEG, PNG o WEBP de hasta 8 MB.",
        };
      const body = new FormData();
      body.set("documento", file);
      await citizenRequest("/api/v1/identity-verifications", isVerification, {
        method: "POST",
        body,
        timeoutMs: 120000,
      });
    } else if (kind === "link") {
      const id = form.get("verificacionIdentidadId");
      if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))
        return { error: "La verificación seleccionada no es válida." };
      await citizenRequest("/api/v1/raes/link", isLink, {
        method: "POST",
        body: { verificacionIdentidadId: id },
      });
    } else return { error: "Operación no válida." };
    revalidatePath("/onboarding");
    revalidatePath("/credentials");
    return {
      message:
        kind === "profile"
          ? "Perfil guardado."
          : kind === "document"
            ? "Documento procesado. Consulta el resultado de la verificación."
            : "Vinculación completada.",
    };
  } catch (error) {
    return {
      error:
        error instanceof WebApiError
          ? error.message
          : "No fue posible confirmar la operación. Actualiza el estado antes de volver a enviar.",
    };
  }
}
