"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function CitizenNavigation() {
  const path = usePathname();
  return (
    <nav aria-label="Navegación ciudadana">
      {[
        ["/credentials", "Credenciales"],
        ["/shares", "Comparticiones"],
        ["/onboarding", "Mi perfil"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href!}
          aria-current={
            path === href || path.startsWith(`${href}/`) ? "page" : undefined
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
