import { Skeleton } from "@raes/ui";
export default function Loading() {
  return (
    <main id="main-content" className="public-verification">
      <Skeleton label="Consultando el estado actual desde RAES" />
    </main>
  );
}
