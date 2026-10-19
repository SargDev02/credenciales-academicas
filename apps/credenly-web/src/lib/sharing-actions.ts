"use server";
import { revalidatePath } from "next/cache";
import { WebApiError } from "@raes/web-core";
import { requireSession } from "./auth";
import { citizenRequest } from "./citizen-api";
import { isCreatedShare, isRevokedShare, prepareShare } from "./sharing-model";
export type ShareResult = {
  error?: string;
  publicPath?: string;
  message?: string;
};
export async function createShare(form: FormData): Promise<ShareResult> {
  await requireSession();
  let body;
  try {
    body = prepareShare(form);
  } catch {
    return {
      error:
        "Revisa la credencial, los campos y una duración entre 1 y 720 horas.",
    };
  }
  try {
    const result = await citizenRequest("/api/v1/shares", isCreatedShare, {
      method: "POST",
      body,
    });
    revalidatePath("/shares");
    // Share token stays in the creation response's component memory only.
    return {
      publicPath: `/verify/${result.data.token}`,
      message: "Enlace creado. Cópialo antes de cerrar este resultado.",
    };
  } catch (error) {
    return {
      error:
        error instanceof WebApiError && error.status < 500
          ? error.message
          : "No pudimos confirmar la creación. Actualiza el listado antes de volver a enviar; el enlace no puede recuperarse.",
    };
  }
}
export async function revokeShare(id: string): Promise<ShareResult> {
  await requireSession();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return { error: "Compartición no válida." };
  try {
    await citizenRequest(`/api/v1/shares/${id}`, isRevokedShare, {
      method: "DELETE",
    });
    revalidatePath("/shares");
    return { message: "Acceso revocado." };
  } catch (error) {
    return {
      error:
        error instanceof WebApiError
          ? error.message
          : "No fue posible confirmar la revocación. Actualiza el listado.",
    };
  }
}
