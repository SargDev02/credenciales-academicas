import {
  Card,
  PageHeading,
  EmptyState,
  Input,
  Button,
  Alert,
  FormField,
} from "@raes/ui";
import { getInstitutions } from "../../../lib/admin-api";
import { InstitutionTable } from "../../../components/institution-table";
import { filterRecords } from "../../../lib/admin-model";
export const metadata = { title: "Instituciones" };
export default async function Institutions({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const query = await searchParams;
  const rows = filterRecords(await getInstitutions(), query.q, query.estado);
  return (
    <>
      <PageHeading eyebrow="REGISTRO INSTITUCIONAL" title="Instituciones">
        Organizaciones registradas y su estado actual.
      </PageHeading>
      <form className="admin-filters">
        <Input
          id="institution-search"
          name="q"
          type="search"
          label="Buscar por nombre"
          defaultValue={query.q ?? ""}
          placeholder="Nombre de la institución"
          maxLength={200}
        />
        <FormField id="institution-status" label="Estado">
          <select
            className="ui-input"
            id="institution-status"
            name="estado"
            defaultValue={query.estado ?? ""}
          >
            <option value="">Todos</option>
            <option value="ACTIVA">Activa</option>
            <option value="INACTIVA">Inactiva</option>
            <option value="SUSPENDIDA">Suspendida</option>
          </select>
        </FormField>
        <Button type="submit" variant="secondary">
          Aplicar filtros
        </Button>
      </form>
      {rows.length ? (
        <InstitutionTable rows={rows} />
      ) : (
        <Card>
          <EmptyState title="Sin instituciones para mostrar">
            Prueba otro nombre o selecciona todos los estados.
          </EmptyState>
        </Card>
      )}
      <div className="admin-section">
        <Alert title="Consulta institucional">
          Las altas y la gestión de integraciones todavía no están habilitadas
          en esta interfaz.
        </Alert>
      </div>
    </>
  );
}
