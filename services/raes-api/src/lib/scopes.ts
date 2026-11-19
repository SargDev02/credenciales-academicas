export const scopeCatalog = [
  { codigo: "academic-review:submit", descripcion: "Presentar cambios académicos para revisión administrativa" },
  {
    codigo: "institution:sync",
    descripcion: "Sincronizar metadatos institucionales, sedes y programas",
  },
  {
    codigo: "persons:sync",
    descripcion: "Resolver y sincronizar personas reportadas por la institución",
  },
  {
    codigo: "credentials:create",
    descripcion: "Registrar nuevas credenciales académicas",
  },
  {
    codigo: "credentials:correct",
    descripcion: "Registrar correcciones como nuevas versiones de una credencial",
  },
  {
    codigo: "credentials:revoke",
    descripcion: "Revocar credenciales académicas",
  },
  {
    codigo: "credentials:annul",
    descripcion: "Anular credenciales académicas",
  },
  {
    codigo: "credentials:read",
    descripcion: "Consultar credenciales autorizadas mediante RAES API",
  },
  {
    codigo: "persons:resolve",
    descripcion: "Resolver una persona maestra por identidad verificada",
  },
] as const;

export type ScopeCode = (typeof scopeCatalog)[number]["codigo"];

export const institutionAScopes: ScopeCode[] = [
  "academic-review:submit", "credentials:read",
];

export const credenlyScopes: ScopeCode[] = [
  "persons:resolve",
  "credentials:read",
];
