# Autenticación de RAES API

## Principio

RAES diferencia dos tipos de consumidores:

1. **Integraciones institucionales**: universidades e instituciones educativas que reportan y actualizan información académica.
2. **Clientes de API**: aplicaciones o verificadores que consumen información de RAES, como Credenly, gobernaciones o terceros autorizados.

Ambos usan credenciales de servidor, pero se almacenan y autorizan por separado. Credenly no se registra como una institución ficticia.

## Credencial de servidor

La cabecera HTTP usa:

```http
Authorization: Bearer <client_id>.<client_secret>
```

El secreto es aleatorio y RAES nunca lo conserva en texto plano:

```text
client_secret
     ↓
SHA-256
     ↓
secret_hash
```

También se almacena un prefijo corto que permite localizar el hash correspondiente. El secreto original se entrega únicamente al crearlo o rotarlo.

## Integraciones institucionales

Tablas principales:

- `integraciones_institucionales`
- `integracion_secretos`
- `integracion_scopes`

Una integración debe estar `ACTIVA`.

Scopes institucionales:

- `institution:sync`
- `persons:sync`
- `credentials:create`
- `credentials:correct`
- `credentials:revoke`
- `credentials:annul`

El scope `credentials:read` existe en el catálogo, pero no se entrega por defecto a los conectores institucionales.

## Clientes de API

Aplicaciones no institucionales usan:

- `clientes_api`
- `cliente_api_secretos`
- `cliente_api_scopes`

Estados:

- `ACTIVO`
- `SUSPENDIDO`
- `REVOCADO`

Tipos iniciales:

- `CREDENLY`
- `VERIFICADOR`
- `GOBERNACION`
- `OTRO`

Credenly recibe únicamente:

- `persons:resolve`
- `credentials:read`

Esto permite que Credenly resuelva una persona después de verificar su identidad y consulte sus credenciales en vivo sin persistir una copia académica.

## Endpoints de clientes

```text
GET  /api/v1/auth/client-whoami
POST /api/v1/persons/resolve
GET  /api/v1/persons/{personId}/credentials
```

## Administración de RAES

Los usuarios de la interfaz administrativa se autentican con Supabase Auth del proyecto RAES y deben tener un registro activo en `perfiles_admin`.

Roles:

- `SUPERADMIN`
- `ADMIN`
- `AUDITOR`

Los roles `SUPERADMIN` y `ADMIN` pueden crear instituciones e integraciones. `AUDITOR` puede consultar, pero no aprovisionar.

Endpoints preparados para la futura RAES Web:

```text
GET  /api/v1/admin/institutions
POST /api/v1/admin/institutions
POST /api/v1/admin/institutions/{institutionId}/integrations

GET  /api/v1/admin/api-clients
POST /api/v1/admin/api-clients
```

De esta forma, cuando se incorpore una nueva universidad, un administrador podrá registrarla desde la interfaz web y generar allí su integración. No será necesario modificar código ni ejecutar un script por institución.

## Secreto de una nueva integración

Al crear una integración institucional o un cliente de API:

1. se genera un `client_id`;
2. se genera un `client_secret`;
3. RAES guarda únicamente el hash;
4. se asignan los scopes;
5. el registro se activa;
6. el secreto se devuelve una sola vez.

La interfaz administrativa deberá advertir al operador que copie el secreto en ese momento.

## Bootstrap histórico de Institución A

El comando de desarrollo:

```bash
pnpm --filter @raes/api bootstrap:institution-a
```

se conserva para reproducibilidad del piloto, pero **no es el mecanismo previsto para incorporar nuevas instituciones en producción**.

## Endpoint institucional de prueba

```text
GET /api/v1/auth/whoami
```

valida la integración institucional y devuelve únicamente su identidad y scopes.


## Bootstrap del primer administrador

Una instalación nueva de RAES no tiene administradores todavía. Para resolver ese único caso se incluye:

```bash
pnpm --filter @raes/api bootstrap:superadmin
```

El comando crea o reutiliza el usuario de Supabase Auth indicado localmente y genera el perfil `SUPERADMIN`. Si detecta que ya existe un SUPERADMIN activo, se detiene sin modificar privilegios.

Este bootstrap no se usa para incorporar universidades. Las universidades se crean posteriormente desde la API administrativa / RAES Web.
