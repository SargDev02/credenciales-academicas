export const scopeCatalog = [
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
] as const;

export type ScopeCode = (typeof scopeCatalog)[number]["codigo"];

export const institutionAScopes: ScopeCode[] = [
  "institution:sync",
  "persons:sync",
  "credentials:create",
  "credentials:correct",
  "credentials:revoke",
  "credentials:annul",
];
