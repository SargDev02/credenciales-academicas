import type { Tone } from "@raes/ui";
import type { Counts, Health, Overview } from "./admin-model";

export const adminNavigation = [
  { href: "/admin", label: "Resumen", context: "Visión general" },
  { href: "/admin/users", label: "Cuentas", context: "Registro de cuentas" },
  {
    href: "/admin/verifications",
    label: "Verificaciones",
    context: "Procesamiento documental",
  },
  {
    href: "/admin/links",
    label: "Vinculaciones",
    context: "Conexión con RAES",
  },
  {
    href: "/admin/shares",
    label: "Comparticiones",
    context: "Enlaces ciudadanos",
  },
  {
    href: "/admin/health",
    label: "Salud",
    context: "Disponibilidad del servicio",
  },
] as const;

export function formatAdminTimestamp(value: string | null) {
  if (!value) return "Sin acceso registrado";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Fecha no disponible"
    : new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
export function stateTone(state: string): Tone {
  if (["ACTIVO", "APROBADA", "VERIFICADA", "ACTIVA"].includes(state))
    return "success";
  if (["RECHAZADA", "REVOCADA", "SUSPENDIDO"].includes(state)) return "danger";
  if (
    ["PENDIENTE", "PENDIENTE_VERIFICACION", "REVISION", "EXPIRADA"].includes(
      state,
    )
  )
    return "warning";
  return "neutral";
}
export const metricDefinitions = [
  {
    key: "profiles",
    title: "Perfiles ciudadanos",
    href: "/admin/users",
    states: [
      ["ACTIVO", "Activos"],
      ["PENDIENTE_VERIFICACION", "Por verificar"],
    ],
  },
  {
    key: "verifications",
    title: "Verificaciones documentales",
    href: "/admin/verifications",
    states: [
      ["APROBADA", "Aprobadas"],
      ["REVISION", "En revisión"],
      ["RECHAZADA", "Rechazadas"],
    ],
  },
  {
    key: "links",
    title: "Vinculaciones RAES",
    href: "/admin/links",
    states: [
      ["VERIFICADA", "Verificadas"],
      ["PENDIENTE", "Pendientes"],
    ],
  },
  {
    key: "shares",
    title: "Comparticiones",
    href: "/admin/shares",
    states: [
      ["ACTIVA", "Activas"],
      ["REVOCADA", "Revocadas"],
      ["EXPIRADA", "Expiradas"],
    ],
  },
] as const satisfies readonly {
  key: keyof Pick<Overview, "profiles" | "verifications" | "links" | "shares">;
  title: string;
  href: string;
  states: readonly (readonly [string, string])[];
}[];

export function metricBreakdown(
  counts: Counts,
  states: readonly (readonly [string, string])[],
) {
  return states.map(([state, label]) => ({
    state,
    label,
    value: counts.byState[state]!,
  }));
}
export function servicePresentation(health: Health) {
  const components = [
    {
      key: "database",
      title: "Credenly Database",
      summary: "Credenly DB",
      available: health.components.database === "up",
      availableLabel: "Disponible",
      description: "Lectura operativa de la base de datos de Credenly.",
    },
    {
      key: "auth",
      title: "Supabase Auth",
      summary: "Auth",
      available: health.components.auth === "up",
      availableLabel: "Disponible",
      description:
        "Consulta real a la API de Supabase Auth. No simula un inicio de sesión.",
    },
    {
      key: "raes",
      title: "RAES API",
      summary: "RAES API",
      available: health.components.raes === "up",
      availableLabel: "Disponible",
      description:
        "Conectividad con RAES mediante su API, sin acceso a su base académica.",
    },
  ];
  return {
    operational:
      health.status === "ready" &&
      health.httpStatus === 200 &&
      components.every((c) => c.available),
    components,
  };
}
export function validAccountPage(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d{0,3}$/.test(value);
}
