import Link from "next/link";
import { EmptyState, buttonClass } from "@raes/ui";
export default function NotFound() {
  return (
    <main id="main-content" className="foundation-home">
      <EmptyState
        title="No encontramos esta página"
        action={
          <Link className={buttonClass()} href="/dashboard">
            Volver al resumen
          </Link>
        }
      >
        El registro o la dirección solicitada no están disponibles.
      </EmptyState>
    </main>
  );
}
