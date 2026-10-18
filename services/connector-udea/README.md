# Connector Universidad de Antioquia

Conector de Institución B, independiente de su base académica. Comparte el motor
`@raes/connector-core` con el Politécnico y mantiene namespace y credenciales propios.

El esquema real se verificó el 2026-10-18: `institucion`, `sedes`, `programas`,
`programa_sede`, `estudiantes`, `matriculas`, `credenciales`; 13 sedes, 13 programas,
35 relaciones, 17 estudiantes, 17 matrículas y 17 credenciales sintéticas existentes.
Todas las tablas mantienen RLS. Los estados fuente `REVOCADO`/`ANULADO` se
normalizan a `REVOCADA`/`ANULADA`. No se añaden tablas ni datos a la institución.

## Configuración y ejecución

Configurar `.env.local` (ignorado por Git) a partir de `.env.example`:

- `UDEA_SUPABASE_URL`, `UDEA_SUPABASE_SERVICE_ROLE_KEY`: lectura server-side de B.
- `RAES_API_BASE_URL`, `RAES_UDEA_CLIENT_ID`, `RAES_UDEA_CLIENT_SECRET`: API RAES.

```bash
pnpm --filter @raes/connector-udea sync
pnpm --filter @raes/connector-udea sync:base
pnpm --filter @raes/connector-udea sync:credentials
```

Scopes: `institution:sync`, `persons:sync`, `credentials:create`, `credentials:read`,
`credentials:correct`, `credentials:revoke`, `credentials:annul`.

La ejecución ordena institución -> sedes -> programas -> programa-sede -> personas
-> credenciales. La reejecución compara el estado vigente; las correcciones
conservan versiones y los estados terminales conservan el historial completo.
Credenciales creadas por otras operaciones se reportan en
`existingCredentialsNotAdopted` y no se adoptan automáticamente. Conflictos con
estados terminales se reportan en `terminalStateConflicts` y producen salida 1.
