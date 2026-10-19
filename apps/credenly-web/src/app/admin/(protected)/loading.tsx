import { PageHeading, Skeleton } from "@raes/ui";
export default function Loading() {
  return (
    <div className="operations-loading" aria-busy="true">
      <PageHeading title="Cargando consulta">
        Estamos consultando los datos operativos de Credenly.
      </PageHeading>
      <div className="operations-stats">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} label="Cargando indicadores" />
        ))}
      </div>
      <Skeleton label="Cargando estado del servicio" />
    </div>
  );
}
