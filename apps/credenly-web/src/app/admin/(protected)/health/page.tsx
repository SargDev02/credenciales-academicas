import { Alert, Card, PageHeading } from "@raes/ui";
import { getAdminHealth } from "../../../../lib/admin-api";
import { date } from "../../../../lib/citizen-model";
export const metadata = { title: "Salud · Administración" };
export default async function HealthPage() {
  const data = await getAdminHealth();
  const components = [
    [
      "Base de datos Credenly",
      data.components.database === "up" ? "Disponible" : "No disponible",
    ],
    [
      "Configuración Auth",
      data.components.auth === "configured" ? "Configurada" : "No disponible",
    ],
    [
      "Conectividad RAES API",
      data.components.raes === "up" ? "Disponible" : "No disponible",
    ],
  ];
  return (
    <>
      <PageHeading eyebrow="DISPONIBILIDAD" title="Salud del servicio">
        Resultado actual del verificador de readiness existente.
      </PageHeading>
      <Alert
        title={
          data.status === "ready"
            ? "Servicio preparado"
            : "Servicio con dependencias no disponibles"
        }
        tone={data.status === "ready" ? "success" : "danger"}
      >
        Readiness HTTP {data.httpStatus} · consultado {date(data.checkedAt)}.
      </Alert>
      <section className="citizen-section">
        <Card>
          <h2>Dependencias comprobadas</h2>
          <dl className="operations-counts">
            {components.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>
      <p className="ui-hint">
        Auth indica que la configuración requerida está presente; no simula un
        inicio de sesión. La conexión con RAES se comprueba mediante su API, sin
        acceso a tablas académicas. Una comprobación favorable no certifica
        preparación para producción.
      </p>
    </>
  );
}
