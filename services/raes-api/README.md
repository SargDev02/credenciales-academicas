# RAES API

Servicio backend central de RAES.

## Estado actual

Servicio Next.js con autenticación institucional, clientes API y administración;
revisión académica transaccional, registro/versionado, correcciones y estados
terminales; consulta ciudadana e institucional y auditoría de clientes API. Las
interfaces RAES Web y Credenly Web están implementadas. Los conectores detectan
cambios y presentan propuestas; solo ADMIN/SUPERADMIN aprueba su incorporación.
Durante detección, `canonicalWrites: 0`. Ver [revisión académica](../../docs/academic-review.md).

Los resultados y límites de validación están en [progreso](../../docs/progress.md). Los cambios de
permisos se aplican con migraciones nuevas; no se editan los históricos aplicados.

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
pnpm install --frozen-lockfile
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

Solo para aprovisionar una instalación nueva autorizada de Institución A
(no para arrancar los proyectos existentes), elegir un directorio seguro existente
fuera del repositorio y ejecutar:

```bash
pnpm --filter @raes/api bootstrap:institution-a --secret-output=/ruta-segura-fuera-del-repositorio/raes-institution-a.json
```

El secreto nuevo se entrega únicamente al archivo indicado, con permisos 0600 y
sin sobrescribir archivos existentes; no se imprime en consola. RAES conserva
solo su hash. Si ya existe un secreto activo, el comando no crea otro ni lo rota
automáticamente. Custodiar la salida fuera de Git.

Prueba de identidad autenticada:

```text
GET /api/v1/auth/whoami
```

Consulta [docs/authentication.md](../../docs/authentication.md) para el diseño completo.


## Ciclo de vida de credenciales

Las rutas históricas siguientes conservan guards contra escrituras canónicas
directas. No son el flujo de sincronización de los conectores actuales ni deben
usarse para saltarse la revisión. La administración incorpora únicamente cambios
aprobados mediante el [workflow académico](../../docs/academic-review.md).

Rutas históricas protegidas:

```text
POST /api/v1/credentials
POST /api/v1/credentials/corrections
POST /api/v1/credentials/revocations
POST /api/v1/credentials/annulments
```

Todas las mutaciones requieren `X-Request-Id` e `Idempotency-Key`. Las correcciones y cambios de estado generan nuevas versiones y eventos; el historial previo no se sobrescribe.


## Administración RAES y alta de nuevas instituciones

La incorporación de nuevas universidades ya no depende de crear scripts específicos por institución.

RAES Web consume los endpoints administrativos existentes:

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

A partir de ese momento, la administración normal debe hacerse por RAES Web y la API administrativa.

## Clientes de API no institucionales

Credenly y otros verificadores no se registran como universidades. Usan clientes separados con secretos hasheados y scopes propios.

Endpoints iniciales:

```text
GET  /api/v1/auth/client-whoami
POST /api/v1/persons/resolve
GET  /api/v1/persons/{personId}/credentials
```

Credenly utiliza `persons:resolve` y `credentials:read`; no recibe acceso a RAES DB.
