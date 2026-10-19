import { Alert } from "@raes/ui";
import { getOverview } from "../../lib/admin-api";
import { sectionStates } from "../../lib/admin-model";
import { AdminHeading } from "./heading";
import { StateCounts } from "./counts";
const sections = {
  verifications: {
    description:
      "Estado del procesamiento documental de las cuentas ciudadanas.",
    title: "Sobre la aprobación documental",
    note: "La aprobación refleja el procesamiento documental del prototipo; no constituye una validación legal de identidad. Este panel muestra conteos, sin documentos, imágenes ni texto OCR.",
  },
  links: {
    description:
      "Estado actual de las referencias ciudadanas a identidades RAES.",
    title: "Identidades vinculadas, sin copia académica",
    note: "Credenly referencia identidades RAES, pero no almacena credenciales académicas. La administración observa los estados; no puede editar identidades ni forzar vinculaciones.",
  },
  shares: {
    description: "Estado de los enlaces de acceso creados por los ciudadanos.",
    title: "Los enlaces pertenecen al ciudadano",
    note: "Admin no puede recuperar tokens completos ni acceder a una credencial usando este panel. Las comparticiones revocadas se cuentan como revocadas aunque su fecha haya vencido; las demás se clasifican por su expiración actual.",
  },
};
export async function OperationalStatePage({
  section,
}: {
  section: keyof typeof sections;
}) {
  const data = await getOverview();
  const definition = sectionStates[section]!;
  const content = sections[section];
  return (
    <>
      <AdminHeading
        title={definition.title}
        description={content.description}
        observedAt={data.observedAt}
      />
      <StateCounts
        title="Distribución por estado"
        labels={definition.labels}
        counts={data[section]}
      />
      <p className="operations-data-note">
        Conteos actuales consultados por separado. No representan una
        instantánea transaccional.
      </p>
      <div className="operations-help">
        <Alert title={content.title}>{content.note}</Alert>
      </div>
    </>
  );
}
