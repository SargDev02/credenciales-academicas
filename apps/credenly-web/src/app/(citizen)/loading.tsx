import { Skeleton } from "@raes/ui";
export default function Loading() {
  return (
    <div className="credential-grid">
      <Skeleton label="Consultando tu información" />
      <Skeleton label="Cargando contenido" />
    </div>
  );
}
