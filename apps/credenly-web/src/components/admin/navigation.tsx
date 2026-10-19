"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";
import { adminNavigation } from "../../lib/admin-presentation";
export function OperationsNavigation() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const current =
    adminNavigation.find((item) => item.href === path) ?? adminNavigation[0];
  return (
    <div className="operations-navigation">
      <button
        ref={trigger}
        type="button"
        className="operations-nav-toggle"
        aria-controls={id}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>
          Navegación
          <span className="operations-nav-current">{current.label}</span>
        </span>
        <span className="operations-menu-symbol" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      <nav
        id={id}
        className={open ? "is-open" : ""}
        aria-label="Administración de Credenly"
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            setOpen(false);
            trigger.current?.focus();
          }
        }}
      >
        <p className="operations-nav-eyebrow">SERVICIO CIUDADANO</p>
        <ul>
          {adminNavigation.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={path === item.href ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <span>{item.label}</span>
                <span aria-hidden="true" className="operations-nav-arrow">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
export function OperationsContext() {
  const path = usePathname();
  const item =
    adminNavigation.find((item) => item.href === path) ?? adminNavigation[0];
  return (
    <div className="operations-context">
      <span>Operación del servicio</span>
      <strong>{item.context}</strong>
    </div>
  );
}
