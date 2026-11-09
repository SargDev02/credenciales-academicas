import Link from "next/link";
import { Card, PageHeading, EmptyState } from "@raes/ui";
import { getInstitutions, getApiClients } from "../../../lib/admin-api";
import { InstitutionTable } from "../../../components/institution-table";
import { formatDate } from "../../../lib/admin-model";
import { getAcademicReviews } from "../../../lib/academic-review-api";
export const metadata = { title: "Resumen" };
export default async function Dashboard() {
  const [institutions, clients, reviews] = await Promise.all([
    getInstitutions(),
    getApiClients(),
    getAcademicReviews({estado:"PENDIENTE",pageSize:1}).then(result=>({total:result.meta.total})).catch(()=>({total:null})),
  ]);
  const recent = [...institutions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  const used =
    clients
      .map((c) => c.ultimoUsoAt)
      .filter((x): x is string => !!x)
      .sort()
      .at(-1) ?? null;
  return (
    <>
      <PageHeading eyebrow="ADMINISTRACIÓN" title="Resumen del registro">
        Consulta las instituciones y los servicios registrados en RAES.
      </PageHeading>
      <div className="admin-stats">
        <Card>
          <span className="stat-label">Pendientes de revisión</span>
          <strong className="stat-value">{reviews.total ?? "—"}</strong>
          {reviews.total === null ? <span className="ui-hint">Consulta no disponible</span> : reviews.total > 0 ? <span className="ui-hint">Hay cambios esperando decisión</span> : <span className="ui-hint">Sin cambios pendientes</span>}
          <Link href="/validations">Ver validaciones →</Link>
        </Card>
        <Card>
          <span className="stat-label">Instituciones visibles</span>
          <strong className="stat-value">{institutions.length}</strong>
          <Link href="/institutions">Consultar instituciones ↗</Link>
        </Card>
        <Card>
          <span className="stat-label">Instituciones activas</span>
          <strong className="stat-value">
            {institutions.filter((i) => i.estado === "ACTIVA").length}
          </strong>
          <span className="ui-hint">Entre los registros disponibles</span>
        </Card>
        <Card>
          <span className="stat-label">Clientes API visibles</span>
          <strong className="stat-value">{clients.length}</strong>
          <Link href="/api-clients">Consultar clientes ↗</Link>
        </Card>
      </div>
      <section className="admin-section">
        <div className="section-heading">
          <h2>Instituciones recientes</h2>
          <Link href="/institutions">Ver todas</Link>
        </div>
        {recent.length ? (
          <InstitutionTable rows={recent} />
        ) : (
          <Card>
            <EmptyState title="Aún no hay instituciones">
              Las instituciones registradas aparecerán aquí.
            </EmptyState>
          </Card>
        )}
      </section>
      <div className="admin-summary-foot">
        <p>Información consultada desde RAES.</p>
        <p>
          Último uso de un cliente registrado:{" "}
          <strong>{formatDate(used)}</strong>
        </p>
      </div>
    </>
  );
}
