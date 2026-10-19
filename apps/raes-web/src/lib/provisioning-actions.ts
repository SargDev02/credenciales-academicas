"use server";
import { revalidatePath } from "next/cache";
import { apiRequest, WebApiError } from "@raes/web-core";
import { requireSession } from "./auth";
import { getAdminProfile } from "./admin-api";
import { getWebConfig } from "./env";
import { canManage } from "./admin-model";
import {
  prepareCreation,
  CreationValidationError,
  isProvisioned,
  isCreatedInstitution,
  type CreationKind,
  type CreationResult,
} from "./provisioning-model";

export async function createRecord(
  kind: CreationKind,
  form: FormData,
): Promise<CreationResult> {
  // Server-side UX guard; every POST also authorizes the current role in RAES API.
  const { token } = await requireSession();
  try {
    if (!canManage(await getAdminProfile()))
      return { error: "Tu rol permite únicamente consultas." };
    const { path, body } = prepareCreation(kind, form);
    const options = { token, method: "POST" as const, body };
    if (kind === "institution") {
      const result = await apiRequest(getWebConfig().apiBase, path, {
        ...options,
        validate: isCreatedInstitution,
      });
      revalidatePath("/institutions");
      revalidatePath("/dashboard");
      return { createdId: result.data.id };
    }
    const result = await apiRequest(getWebConfig().apiBase, path, {
      ...options,
      validate: isProvisioned,
    });
    revalidatePath("/api-clients");
    revalidatePath("/dashboard");
    // Never pass the complete backend result (or Authorization bearer) to the browser.
    return {
      createdId: (result.data.client ?? result.data.integration)!.id,
      credentials: {
        clientId: result.data.credentials.clientId,
        clientSecret: result.data.credentials.clientSecret,
        scopes: result.data.scopes,
      },
    };
  } catch (error) {
    if (error instanceof CreationValidationError)
      return { error: error.message, fieldErrors: error.fields };
    if (error instanceof WebApiError)
      return {
        error:
          error.status >= 500
            ? "No pudimos confirmar el resultado. Revisa el listado antes de volver a enviar; el alta podría haberse realizado y un secreto no se puede recuperar."
            : error.message,
      };
    return {
      error:
        "No fue posible completar el alta. Revisa el listado antes de volver a intentar.",
    };
  }
}
