"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const links = [["/admin", "Resumen"], ["/admin/users", "Cuentas"], ["/admin/verifications", "Verificación documental"], ["/admin/links", "Vinculaciones RAES"], ["/admin/shares", "Comparticiones"], ["/admin/health", "Salud del servicio"]];
export function OperationsNavigation() { const path = usePathname(); return <nav aria-label="Administración de Credenly"><ul>{links.map(([href, label]) => <li key={href}><Link href={href!} aria-current={path === href ? "page" : undefined}>{label}</Link></li>)}</ul></nav>; }
