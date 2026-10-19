import Link from "next/link";
import { EmptyState } from "@raes/ui";
export default function NotFound() {
  return (
    <main id="main-content" className="citizen-content">
      <EmptyState title="No encontramos esta página">
        La dirección o la credencial no está disponible.
      </EmptyState>
      <Link href="/credentials">Volver a mis credenciales</Link>
    </main>
  );
}
