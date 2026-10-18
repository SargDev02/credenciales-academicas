# Desarrollo

## Requisitos

- Node.js 20 o superior.
- pnpm.
- Acceso autorizado a los proyectos Supabase.

## Secretos

Los secretos nunca se confirman en Git.

Cada servicio recibe únicamente las credenciales que necesita:

- `connector-poli`: Institución A + credenciales cliente RAES.
- `raes-api`: RAES.
- Credenly: su propia base + acceso autorizado a la API RAES.

Credenly nunca recibe una service role key de RAES.

## Validación de auditoría de clientes

Con la migración `20261018163434_api_client_audit.sql` aplicada en RAES y sus
credenciales locales existentes, iniciar el backend compilado en un puerto libre:

```bash
pnpm --filter @raes/api build
pnpm --filter @raes/api exec next start -p 3101
```

En otra terminal, desde `services/raes-api`:

```bash
node --env-file=.env.local --env-file=../credenly-api/.env.local --import=tsx scripts/verify-api-client-audit.ts
```

El script consulta una persona existente, verifica respuestas y cuatro eventos de
auditoría sin imprimir identidad ni secretos. Solo agrega auditoría; no modifica
personas, credenciales, versiones ni eventos académicos. Se restringe a un
servidor local; el puerto puede cambiarse con `RAES_AUDIT_TEST_API_BASE_URL`.

`supabase/raes/tests/api_client_audit.sql` verifica los cuatro tipos de actor,
rechazo de actores desconocidos y aislamiento de `anon`/`authenticated`. Toda
fila de prueba se revierte dentro de la transacción. Ejecutarlo en RAES mediante
una conexión SQL autorizada; no requiere nuevas claves.

`pnpm lint` existe en la raíz, pero actualmente ningún paquete declara un script
`lint`: su salida exitosa no constituye una revisión estática de estilo.
