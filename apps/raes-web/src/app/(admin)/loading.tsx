import { Skeleton, PageHeading } from "@raes/ui";
export default function Loading() {
  return (
    <>
      <PageHeading title="Cargando el registro">
        Espera mientras consultamos la información.
      </PageHeading>
      <div className="admin-stats">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    </>
  );
}
