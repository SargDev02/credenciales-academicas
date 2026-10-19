"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const items = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/institutions", label: "Instituciones" },
  { href: "/api-clients", label: "Clientes API" },
  { href: "/audit", label: "Auditoría" },
];
export function Navigation() {
  const path = usePathname();
  return (
    <nav aria-label="Administración">
      <ul className="admin-navigation">
        {items.map((item, i) => {
          const active = path === item.href || path.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined}>
                <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
