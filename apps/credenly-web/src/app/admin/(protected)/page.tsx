import Link from "next/link";
import { Card, MetricCard } from "@raes/ui";
import { WebApiError } from "@raes/web-core";
import { getOverview, getAdminHealth } from "../../../lib/admin-api";
import {
  metricBreakdown,
  metricDefinitions,
} from "../../../lib/admin-presentation";
import { AdminHeading } from "../../../components/admin/heading";
import { ServiceStatus } from "../../../components/admin/service-status";
import { AdministrativeIncidents } from "../../../components/admin/incidents";
export const metadata = { title: "Resumen operativo" };
export default async function Operations() {
  const [data, health] = await Promise.all([
    getOverview(),
    getAdminHealth()
      .then((value) => ({ value }))
      .catch((error) => {
        if (error instanceof WebApiError) return { value: null };
        throw error;
      }),
  ]);
  return (
    <>
      <AdminHeading
        title="Resumen operativo"
        description="Estado actual de los procesos ciudadanos de Credenly."
        observedAt={data.observedAt}
      />
      <div className="operations-stats">
        {metricDefinitions.map((metric) => (
          <MetricCard
            key={metric.key}
            title={metric.title}
            value={data[metric.key].total}
            action={
              <Link href={metric.href}>
                Ver detalle
                <span className="ui-visually-hidden"> de {metric.title}</span>
                <span aria-hidden="true"> →</span>
              </Link>
            }
          >
            <dl className="operations-metric-breakdown">
              {metricBreakdown(data[metric.key], metric.states).map((item) => (
                <div key={item.state}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </MetricCard>
        ))}
      </div>
      <p className="operations-data-note">
        Conteos actuales, sin tendencias históricas. Los procesos se consultan
        por separado.
      </p>
      <div className="operations-dashboard-panels">
        {health.value ? (
          <ServiceStatus data={health.value} />
        ) : (
          <Card className="operations-system">
            <h2>Estado del sistema</h2>
            <div role="status">
              <h3>Salud no disponible</h3>
              <p className="ui-muted">
                No pudimos consultar la disponibilidad. Los indicadores de
                procesos corresponden a su última consulta.
              </p>
            </div>
            <Link href="/admin/health">Consultar salud del servicio</Link>
          </Card>
        )}
        <AdministrativeIncidents incidents={data.incidents} />
      </div>
    </>
  );
}
