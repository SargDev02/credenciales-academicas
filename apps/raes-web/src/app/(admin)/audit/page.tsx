import { PageHeading, Card, EmptyState } from "@raes/ui";
import { getInstitutions } from "../../../lib/admin-api";
export const metadata = { title: "Auditoría" };
export default async function Audit() {
  await getInstitutions();
  return (
    <>
      <PageHeading eyebrow="TRAZABILIDAD" title="Auditoría">
        Consulta de la actividad administrativa y de los consumidores del
        registro.
      </PageHeading>
      <Card>
        <EmptyState title="La consulta de auditoría aún no está disponible">
          La actividad se registra en RAES. Esta versión todavía no permite
          consultar esos registros desde la interfaz.
        </EmptyState>
      </Card>
    </>
  );
}
