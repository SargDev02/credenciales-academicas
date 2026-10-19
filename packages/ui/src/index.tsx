import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

export const buttonClass = (variant: "primary" | "secondary" = "primary") => `ui-button ui-button--${variant}`;
export function Button({ variant = "primary", busy = false, children, disabled, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary"; busy?: boolean }) {
  return <button type="button" {...props} className={`${buttonClass(variant)} ${className}`} disabled={disabled || busy} aria-busy={busy || undefined}>{busy && <Spinner label="Procesando" />}{children}</button>;
}
export function FormField({ label, id, error, hint, children }: { label: string; id: string; error?: string | undefined; hint?: string | undefined; children: ReactNode }) {
  return <div className="ui-field"><label htmlFor={id}>{label}</label>{children}{hint && <p id={`${id}-hint`} className="ui-hint">{hint}</p>}{error && <p id={`${id}-error`} className="ui-field-error">{error}</p>}</div>;
}
export function Input({ label, error, hint, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; error?: string | undefined; hint?: string | undefined }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;
  return <FormField label={label} id={id} error={error} hint={hint}><input {...props} id={id} className={`ui-input ${props.className ?? ""}`} aria-invalid={!!error || undefined} aria-describedby={describedBy} /></FormField>;
}
export type Tone = "neutral" | "success" | "danger" | "warning";
export function Badge({ children, tone = "neutral", size = "design" }: { children: ReactNode; tone?: Tone; size?: "design" | "compact" }) {
  return <span className={`ui-badge ui-badge--${tone} ui-badge--${size}`}>{children}</span>;
}
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`ui-card ${className}`}>{children}</section>;
}
export function CredentialCard({ category, title, institution, issuedAt, status, children, actions }: { category: string; title: string; institution: string; issuedAt?: string; status: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return <article className="ui-credential"><p className="ui-eyebrow">{category}</p><h3>{title}</h3><p className="ui-muted">{institution}</p><div className="ui-credential-meta">{issuedAt && <span>Emitida: {issuedAt}</span>}{status}</div>{children}{actions && <div className="ui-actions">{actions}</div>}</article>;
}
export function Alert({ title, children, tone = "neutral" }: { title: string; children?: ReactNode; tone?: Tone }) {
  return <div className={`ui-alert ui-alert--${tone}`} role={tone === "danger" ? "alert" : "status"}><strong>{title}</strong>{children && <div>{children}</div>}</div>;
}
export function Spinner({ label = "Cargando" }: { label?: string }) { return <span className="ui-spinner" role="status"><span className="ui-visually-hidden">{label}</span></span>; }
export function Skeleton({ label = "Cargando contenido" }: { label?: string }) { return <div className="ui-skeleton" role="status"><span className="ui-visually-hidden">{label}</span></div>; }
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <div className="ui-empty"><span className="ui-empty-mark" aria-hidden="true">—</span><h2>{title}</h2><p>{children}</p>{action}</div>; }
export function PageHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) { return <header className="ui-page-heading">{eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{children && <p className="ui-muted">{children}</p>}</header>; }
export function DesignSystem() {
  return <main className="ui-gallery"><PageHeading eyebrow="00 · Design System" title="Una identidad, dos experiencias">Referencia de componentes. Los datos de esta página son exclusivamente de demostración.</PageHeading><Card><h2>Acciones y campos</h2><div className="ui-actions"><Button>Continuar</Button><Button variant="secondary">Cancelar</Button><Button disabled>No disponible</Button></div><Input id="demo-email" label="Correo electrónico" placeholder="Ingresa la información" type="email" /><Input id="demo-error" label="Campo con error" error="Revisa la información ingresada." /></Card><Card><h2>Estados de credencial</h2><div className="ui-actions"><Badge tone="success">Vigente</Badge><Badge tone="danger">Revocada</Badge><Badge tone="warning">Anulada</Badge></div><p className="ui-muted">Variante compacta para interfaces de gestión</p><div className="ui-actions"><Badge tone="success" size="compact">Vigente</Badge><Badge tone="danger" size="compact">Revocada</Badge><Badge tone="warning" size="compact">Anulada</Badge></div></Card><CredentialCard category="CERTIFICADO DE EJEMPLO" title="Formación académica de demostración" institution="Institución de demostración" issuedAt="18 oct 2026" status={<Badge tone="success">Vigente</Badge>} /><Alert title="Información de ejemplo">Esta página no consulta ni representa datos académicos reales.</Alert><Skeleton /><EmptyState title="Todavía no hay elementos">Los elementos disponibles aparecerán aquí.</EmptyState></main>;
}
