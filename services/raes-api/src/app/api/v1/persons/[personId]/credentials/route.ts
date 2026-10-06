import {
  ApiClientAuthError,
  apiClientAuthErrorResponse,
  authenticateApiClient,
} from "@/lib/api-client-auth";
import {
  ConsumerReadError,
  consumerReadErrorResponse,
  listCredentialsForPerson,
} from "@/lib/consumer-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ personId: string }>;
  },
) {
  try {
    await authenticateApiClient(request, ["credentials:read"]);

    const { personId } = await context.params;
    const credentials = await listCredentialsForPerson(personId);

    return Response.json({
      data: credentials.map((credential) => ({
        id: credential.id,
        codigoRaes: credential.codigo_raes,
        tipo: credential.tipo,
        categoria: credential.categoria,
        estadoActual: credential.estado_actual,
        versionActual: credential.version_actual,
        fechaRegistroRaes: credential.fecha_registro_raes,
        revocadaAt: credential.revocada_at,
        motivoRevocacion: credential.motivo_revocacion,
        anuladaAt: credential.anulada_at,
        motivoAnulacion: credential.motivo_anulacion,
        institucion: credential.instituciones,
        programa: credential.programas,
        sede: credential.sedes,
        version: credential.currentVersion
          ? {
              numeroVersion:
                credential.currentVersion.numero_version,
              tipo: credential.currentVersion.tipo,
              categoria: credential.currentVersion.categoria,
              titulo: credential.currentVersion.titulo,
              descripcion: credential.currentVersion.descripcion,
              fechaEmision:
                credential.currentVersion.fecha_emision,
              fechaGrado: credential.currentVersion.fecha_grado,
              estadoReportado:
                credential.currentVersion.estado_reportado,
              numeroActa:
                credential.currentVersion.numero_acta,
              numeroFolio:
                credential.currentVersion.numero_folio,
              numeroLibro:
                credential.currentVersion.numero_libro,
              createdAt: credential.currentVersion.created_at,
            }
          : null,
      })),
    });
  } catch (error) {
    if (error instanceof ApiClientAuthError) {
      return apiClientAuthErrorResponse(error);
    }

    if (error instanceof ConsumerReadError) {
      return consumerReadErrorResponse(error);
    }

    return consumerReadErrorResponse(error);
  }
}
