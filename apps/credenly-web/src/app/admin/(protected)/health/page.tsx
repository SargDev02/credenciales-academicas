import { Alert } from "@raes/ui";
import { getAdminHealth } from "../../../../lib/admin-api";
import { AdminHeading } from "../../../../components/admin/heading";
import { ServiceStatus } from "../../../../components/admin/service-status";
export const metadata = { title: "Salud · Administración" };
export default async function HealthPage() {
  const data = await getAdminHealth();
  return (
    <>
      <AdminHeading
        title="Salud del servicio"
        description="Disponibilidad actual de las dependencias de Credenly."
        observedAt={data.checkedAt}
      />
      <ServiceStatus data={data} detailed />
      <div className="operations-help">
        <Alert title="Lectura de disponibilidad">
          La comprobación consulta las dependencias del servicio en este
          momento. Auth configurado no equivale a una prueba de login y un
          resultado operativo no certifica preparación para producción.
        </Alert>
      </div>
    </>
  );
}
