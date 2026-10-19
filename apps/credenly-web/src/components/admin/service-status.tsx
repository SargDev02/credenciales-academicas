import Link from "next/link";
import { Badge, Card } from "@raes/ui";
import type { Health } from "../../lib/admin-model";
import {
  formatAdminTimestamp,
  servicePresentation,
} from "../../lib/admin-presentation";

export function ServiceStatus({
  data,
  detailed = false,
}: {
  data: Health;
  detailed?: boolean;
}) {
  const { operational, components } = servicePresentation(data);
  return (
    <>
      <Card className="operations-system">
        <div className="operations-panel-heading">
          <div>
            <p className="ui-eyebrow">DISPONIBILIDAD</p>
            <h2>{detailed ? "Estado general" : "Estado del sistema"}</h2>
          </div>
          <Badge size="compact" tone={operational ? "success" : "warning"}>
            {operational ? "Operativo" : "Requiere atención"}
          </Badge>
        </div>
        {!detailed && (
          <dl className="operations-service-summary">
            {components.map((component) => (
              <div key={component.key}>
                <dt>{component.summary}</dt>
                <dd>
                  <Badge
                    size="compact"
                    tone={component.available ? "success" : "danger"}
                  >
                    {component.available
                      ? component.availableLabel
                      : "No disponible"}
                  </Badge>
                </dd>
              </div>
            ))}
          </dl>
        )}
        <div className="operations-panel-footer">
          <p>
            Readiness HTTP <strong>{data.httpStatus}</strong> ·{" "}
            <time dateTime={data.checkedAt}>
              {formatAdminTimestamp(data.checkedAt)}
            </time>
          </p>
          {!detailed && (
            <Link href="/admin/health">
              Ver salud del servicio<span aria-hidden="true"> →</span>
            </Link>
          )}
        </div>
      </Card>
      {detailed && (
        <div className="operations-dependencies">
          {components.map((component) => (
            <Card key={component.key} className="operations-dependency">
              <div className="operations-dependency-mark" aria-hidden="true">
                {component.key === "database"
                  ? "DB"
                  : component.key === "auth"
                    ? "AU"
                    : "API"}
              </div>
              <h2>{component.title}</h2>
              <Badge
                size="compact"
                tone={component.available ? "success" : "danger"}
              >
                {component.available
                  ? component.availableLabel
                  : "No disponible"}
              </Badge>
              <p className="ui-muted">{component.description}</p>
              <p className="operations-timestamp">
                Última consulta
                <time dateTime={data.checkedAt}>
                  {formatAdminTimestamp(data.checkedAt)}
                </time>
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
