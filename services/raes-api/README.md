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


## Ciclo de vida de credenciales

Endpoints institucionales:

```text
POST /api/v1/credentials
POST /api/v1/credentials/corrections
POST /api/v1/credentials/revocations
POST /api/v1/credentials/annulments
```

Todas las mutaciones requieren `X-Request-Id` e `Idempotency-Key`. Las correcciones y cambios de estado generan nuevas versiones y eventos; el historial previo no se sobrescribe.


## Administración RAES y alta de nuevas instituciones

La incorporación de nuevas universidades ya no depende de crear scripts específicos por institución.

La futura RAES Web utilizará:

```text
GET  /api/v1/admin/institutions
POST /api/v1/admin/institutions
POST /api/v1/admin/institutions/{institutionId}/integrations

GET  /api/v1/admin/api-clients
POST /api/v1/admin/api-clients
```

Los administradores se autentican con Supabase Auth del proyecto RAES y deben tener un perfil activo en `perfiles_admin`.

### Bootstrap inicial del primer SUPERADMIN

Solo para inicializar una instalación nueva de RAES, agregar temporalmente a `.env.local`:

```text
RAES_BOOTSTRAP_ADMIN_EMAIL=
RAES_BOOTSTRAP_ADMIN_PASSWORD=
RAES_BOOTSTRAP_ADMIN_NOMBRES=
RAES_BOOTSTRAP_ADMIN_APELLIDOS=
```

y ejecutar:

```bash
pnpm --filter @raes/api bootstrap:superadmin
```

El comando se bloquea automáticamente cuando RAES ya tiene un `SUPERADMIN` activo. Después del bootstrap, se recomienda retirar esas cuatro variables locales.

A partir de ese momento, la administración normal debe hacerse por la API administrativa y, posteriormente, por RAES Web.

## Clientes de API no institucionales

Credenly y otros verificadores no se registran como universidades. Usan clientes separados con secretos hasheados y scopes propios.

Endpoints iniciales:

```text
GET  /api/v1/auth/client-whoami
POST /api/v1/persons/resolve
GET  /api/v1/persons/{personId}/credentials
```

Credenly utilizará `persons:resolve` y `credentials:read`.
