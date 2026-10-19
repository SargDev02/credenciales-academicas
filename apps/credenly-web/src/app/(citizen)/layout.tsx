import Link from "next/link";
import { CitizenNavigation } from "../../components/citizen-navigation";
import { Button } from "@raes/ui";
import { requireSession } from "../../lib/auth";
import { logout } from "../../lib/auth-actions";
export const dynamic = "force-dynamic";
export default async function CitizenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  return (
    <div className="citizen-app">
      <header className="citizen-header">
        <Link href="/credentials" className="citizen-wordmark">
          Credenly<span>TU HISTORIA ACADÉMICA</span>
        </Link>
        <CitizenNavigation />
        <form action={logout}>
          <Button variant="secondary" type="submit">
            Salir
          </Button>
        </form>
      </header>
      <main id="main-content" className="citizen-content">
        {children}
      </main>
      <footer className="citizen-footer">
        Credenly · Consulta viva desde RAES <span>Entorno de prototipo</span>
      </footer>
    </div>
  );
}
