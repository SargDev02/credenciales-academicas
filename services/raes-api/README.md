# RAES API

Servicio backend central de RAES.

## Etapa actual

La primera versión incluye:

- servicio Next.js independiente;
- validación de variables de entorno;
- cliente Supabase de servidor;
- endpoint de vida;
- endpoint de disponibilidad con prueba real contra la base de RAES.

Todavía no contiene autenticación institucional ni endpoints de sincronización académica.

## Configuración local

Desde la raíz del repositorio:

```bash
cp services/raes-api/.env.example services/raes-api/.env.local
```

Completar únicamente en `.env.local`:

```text
RAES_SUPABASE_URL=...
RAES_SUPABASE_SERVICE_ROLE_KEY=...
```

Nunca confirmar ese archivo en Git.

## Ejecutar

```bash
pnpm install
pnpm --filter @raes/api typecheck
pnpm --filter @raes/api dev
```

El servicio escucha en:

```text
http://localhost:3001
```

## Health checks

Vida del proceso:

```text
GET /api/v1/health
```

Disponibilidad de la base RAES:

```text
GET /api/v1/health/ready
```

El endpoint `ready` utiliza la service role exclusivamente desde el servidor y no devuelve credenciales ni detalles sensibles del error.

## Autenticación institucional

La autenticación usa:

```text
Authorization: Bearer <client_id>.<client_secret>
```

Para preparar Institución A durante desarrollo:

```bash
pnpm --filter @raes/api bootstrap:institution-a
```

El secreto generado se muestra una sola vez y RAES almacena únicamente su hash.

Prueba de identidad autenticada:

```text
GET /api/v1/auth/whoami
```

Consulta [docs/authentication.md](../../docs/authentication.md) para el diseño completo.
