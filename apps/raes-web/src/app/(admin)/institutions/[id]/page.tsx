import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeading, Alert } from "@raes/ui";
import { getInstitutions } from "../../../../lib/admin-api";
import { Status } from "../../../../components/status";
import { formatDate } from "../../../../lib/admin-model";
export const metadata = { title: "Detalle institucional" };
export default async function InstitutionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const institution = (await getInstitutions()).find((i) => i.id === id);
  if (!institution) notFound();
  return (
    <>
      <Link className="back-link" href="/institutions">
        ← Instituciones
      </Link>
      <PageHeading eyebrow="FICHA INSTITUCIONAL" title={institution.nombre}>
        Información vigente del registro institucional.
      </PageHeading>
      <Card>
        <div className="section-heading">
          <h2>Datos de la institución</h2>
          <Status value={institution.estado} />
        </div>
        <dl className="admin-details">
          {[
            ["NIT", institution.nit],
            ["Código SNIES", institution.codigoSnies ?? "No informado"],
            ["Tipo de institución", institution.tipoInstitucion],
            ["Registro", formatDate(institution.createdAt)],
            ["Última actualización", formatDate(institution.updatedAt)],
            ["Identificador", institution.id],
          ].map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <div className="admin-section">
        <Alert title="Integraciones institucionales">
          El listado de integraciones y su gestión no están disponibles en esta
          versión de la interfaz.
        </Alert>
      </div>
    </>
  );
}
