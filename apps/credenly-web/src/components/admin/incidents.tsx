import { Badge, Card } from "@raes/ui";
import type { Overview } from "../../lib/admin-model";
import { formatAdminTimestamp } from "../../lib/admin-presentation";
const actions: Record<string, string> = {
  ADMIN_PROFILE_READ: "Consulta de perfil administrativo",
  OPERATIONS_READ: "Consulta de procesos ciudadanos",
  AUTH_ACCOUNTS_READ: "Consulta de cuentas",
  HEALTH_READ: "Consulta de salud",
};
export function AdministrativeIncidents({
  incidents,
}: {
  incidents: Overview["incidents"];
}) {
  return (
    <Card className="operations-incidents">
      <div className="operations-panel-heading">
        <div>
          <p className="ui-eyebrow">SUPERVISIÓN</p>
          <h2>Incidencias administrativas</h2>
        </div>
        <span className="operations-subtle">Últimos registros</span>
      </div>
      {incidents.length ? (
        <ul>
          {incidents.map((incident) => (
            <li key={incident.id}>
              <div>
                <Badge size="compact" tone="danger">
                  Error
                </Badge>
                <span>{actions[incident.action]}</span>
              </div>
              <time dateTime={incident.occurredAt}>
                {formatAdminTimestamp(incident.occurredAt)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <div className="operations-inline-empty">
          <span className="operations-empty-mark" aria-hidden="true">
            ✓
          </span>
          <div>
            <h3>Sin incidencias administrativas registradas.</h3>
            <p>
              La ausencia de registros no significa que no existan errores en
              otros procesos.
            </p>
          </div>
        </div>
      )}
      <p className="operations-panel-note">
        Fuente: auditoría administrativa. Hasta diez registros de consultas; no
        representa todos los errores del sistema.
      </p>
    </Card>
  );
}
