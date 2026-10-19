import { Alert, PageHeading } from "@raes/ui";
import { getOverview } from "../../lib/admin-api";
import { sectionStates } from "../../lib/admin-model";
import { date } from "../../lib/citizen-model";
import { StateCounts } from "./counts";

const descriptions = {
  verifications:
    "Estados del proceso documental existente. La aprobación OCR no acredita autenticidad legal ni constituye KYC. Este panel no permite revisión manual y no muestra documentos ni texto OCR.",
  links:
    "Estado de las vinculaciones ciudadanas con RAES. Solo se consultan conteos; no se transfieren relaciones ni se resuelven identidades desde administración.",
  shares:
    "Las comparticiones revocadas se cuentan como revocadas aunque su fecha haya vencido. Las demás se clasifican por su expiración actual. No se recuperan tokens ni se accede al contenido académico.",
};
export async function OperationalStatePage({
  section,
}: {
  section: keyof typeof descriptions;
}) {
  const data = await getOverview();
  const definition = sectionStates[section]!;
  return (
    <>
      <PageHeading eyebrow="ESTADOS OPERATIVOS" title={definition.title}>
        Distribución actual del proceso, sin acceso a información personal.
      </PageHeading>
      <StateCounts
        title="Distribución por estado"
        labels={definition.labels}
        counts={data[section]}
      />
      <p className="live-note">
        Consulta: {date(data.observedAt)}. Los conteos se consultan por separado
        y pueden variar durante la lectura.
      </p>
      <Alert title="Alcance de esta consulta">{descriptions[section]}</Alert>
    </>
  );
}
