import Link from "next/link";
import { Alert, Card, EmptyState, PageHeading } from "@raes/ui";
import { getOverview } from "../../../lib/admin-api";
import { date } from "../../../lib/citizen-model";
export const metadata = { title: "Resumen operativo" };
export default async function Operations() {
  const data = await getOverview();
  return (
    <>
      <PageHeading eyebrow="SUPERVISIÓN DE CREDENLY" title="Resumen operativo">
        Indicadores actuales de los procesos ciudadanos. Solo lectura.
      </PageHeading>
      <div className="operations-stats">
        {[
          ["Perfiles ciudadanos", data.profiles.total, "/admin/users"],
          ["Verificaciones", data.verifications.total, "/admin/verifications"],
          ["Vinculaciones", data.links.total, "/admin/links"],
          ["Comparticiones", data.shares.total, "/admin/shares"],
        ].map(([label, value, href]) => (
          <Card key={String(label)}>
            <p>{label}</p>
            <strong>{value}</strong>
            <Link href={String(href)}>
              Consultar estado
              <span className="ui-visually-hidden"> de {label}</span>
            </Link>
          </Card>
        ))}
      </div>
      <p className="live-note">
        Consulta: {date(data.observedAt)}. Conteos actuales; no representan
        series históricas ni una instantánea transaccional.
      </p>
      <Card>
        <h2>Errores administrativos registrados</h2>
        <p className="ui-hint">
          Fuente: auditoría administrativa de Credenly. Se muestran hasta diez
          registros, sin payloads ni datos privados.
        </p>
        {data.incidents.length ? (
          <ul className="operations-incidents">
            {data.incidents.map((i) => (
              <li key={i.id}>
                <span>
                  {
                    (
                      {
                        ADMIN_PROFILE_READ: "Consulta de perfil administrativo",
                        OPERATIONS_READ: "Consulta operativa",
                        AUTH_ACCOUNTS_READ: "Consulta de cuentas",
                        HEALTH_READ: "Consulta de salud",
                      } as Record<string, string>
                    )[i.action]
                  }
                </span>
                <span>Error · {date(i.occurredAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Sin errores administrativos registrados">
            La ausencia de registros no sustituye la comprobación de salud del
            servicio.
          </EmptyState>
        )}
      </Card>
      <div className="citizen-section">
        <Alert title="Alcance de supervisión">
          Este panel no muestra documentos, imágenes OCR, sesiones, contraseñas,
          enlaces completos ni credenciales académicas.{" "}
          <Link href="/admin/health">Comprobar salud</Link>
        </Alert>
      </div>
    </>
  );
}
