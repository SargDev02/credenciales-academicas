import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Alert, Card, PageHeading, buttonClass } from "@raes/ui";
import { getCredentials, getRaesLink } from "../../../../lib/citizen-api";
import { date } from "../../../../lib/citizen-model";
import { CredentialStatus } from "../../../../components/credential-status";
export const metadata = { title: "Detalle de credencial" };
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if ((await getRaesLink())?.estado !== "VERIFICADA") redirect("/onboarding");
  const { id } = await params;
  const c = (await getCredentials()).find((item) => item.id === id);
  if (!c) notFound();
  const terminal =
    c.estadoActual === "REVOCADA"
      ? { date: c.revocadaAt, reason: c.motivoRevocacion }
      : c.estadoActual === "ANULADA"
        ? { date: c.anuladaAt, reason: c.motivoAnulacion }
        : null;
  return (
    <>
      <Link href="/credentials">← Mis credenciales</Link>
      <PageHeading eyebrow={c.categoria} title={c.version?.titulo ?? c.tipo}>
        {c.institucion?.nombre ?? "Institución no informada"}
      </PageHeading>
      <CredentialStatus state={c.estadoActual} />
      {terminal && (
        <div className="citizen-section">
          <Alert
            title={`Credencial ${c.estadoActual === "REVOCADA" ? "revocada" : "anulada"}`}
            tone={c.estadoActual === "REVOCADA" ? "danger" : "warning"}
          >
            <p>Estado histórico vigente desde {date(terminal.date)}.</p>
            <p>
              {terminal.reason ??
                "El motivo no está disponible en la consulta."}
            </p>
          </Alert>
        </div>
      )}
      <Card>
        <dl className="credential-details">
          {[
            ["Código RAES", c.codigoRaes],
            ["Tipo", c.tipo],
            ["Programa", c.programa?.nombre],
            ["Sede", c.sede?.nombre],
            ["Fecha de emisión", date(c.version?.fechaEmision)],
            ["Fecha de grado", date(c.version?.fechaGrado)],
            ["Versión", String(c.versionActual)],
            ["Descripción", c.version?.descripcion],
            ["Acta", c.version?.numeroActa],
            ["Folio", c.version?.numeroFolio],
            ["Libro", c.version?.numeroLibro],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value ?? "No informado"}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <p className="live-note">
        Información consultada desde RAES. Este resultado corresponde al estado
        actual.
      </p>
      <Link
        className={buttonClass()}
        href={`/shares?credential=${encodeURIComponent(c.id)}`}
      >
        Compartir credencial
      </Link>
    </>
  );
}
