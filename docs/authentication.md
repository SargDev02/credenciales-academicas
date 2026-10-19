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

Los conectores reciben también `credentials:read` para consultar exclusivamente su estado vigente mediante `/credentials/source/{code}`. Esta ruta autentica integraciones institucionales y filtra por su institución; no habilita el acceso a rutas de clientes API.

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

### Auditoría de consultas de clientes

`persons:resolve` y `credentials:read` registran `PERSON_RESOLVE` y
`CREDENTIALS_READ` en `auditoria`, con `actor_tipo = CLIENTE_API` y
`actor_id = clientes_api.id`. Se reutilizan `recurso_tipo = PERSONA`,
`recurso_id` (persona resuelta/consultada en respuestas exitosas) y `created_at`.
No se agregan tablas ni relaciones: `actor_id` ya era un UUID polimórfico.

La metadata contiene exclusivamente `endpoint` (plantilla fija), `resultado`
(`OK`, `DENEGADO`, `NO_ENCONTRADO`, `ERROR_VALIDACION`, `ERROR`) y `http_status`.
No se guardan documentos, nombres, cuerpos, headers, query strings, secretos,
IP ni user agent. Los errores de validación tampoco devuelven el input recibido.

La autenticación precede a la autorización para auditar un scope insuficiente con
actor verificado. Una credencial ausente o inválida devuelve 401 sin atribuirla
a un cliente a partir de un Bearer no verificado. `client-whoami` conserva su
comportamiento de diagnóstico y no genera estos eventos de consulta académica.

La auditoría se espera antes de entregar la respuesta. Si falla, se devuelve
`503 AUDIT_UNAVAILABLE` sin datos académicos y se registra solo la operación en
el log del servidor. Esto prioriza trazabilidad sobre disponibilidad de lectura;
las lecturas pueden reintentarse. No se modifica el versionado académico.

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

Las RPC de aprovisionamiento solo admiten ejecución desde `service_role`, después
de los controles administrativos del backend. Los grants se revocan explícitamente
a `PUBLIC`, `anon` y `authenticated`; revocar únicamente `PUBLIC` no elimina
grants directos existentes. Se mantiene un `search_path` vacío y referencias a
tablas calificadas con `public`. La prueba SQL
`supabase/raes/tests/provisioning_rpc_permissions.sql` verifica los tres roles
sin crear instituciones ni clientes.

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

## Restablecimiento local de una contraseña administrativa

Para una cuenta existente y con autorización de su titular, desde la raíz:

```bash
pnpm --filter @raes/api admin:reset-password --email cuenta@dominio --check
pnpm --filter @raes/api admin:reset-password --email cuenta@dominio
```

El primer comando solo comprueba cuenta/perfil. El segundo pide la nueva contraseña
oculta y su confirmación en una terminal interactiva (12–256 caracteres). No acepta
contraseñas por argumentos, variables ni archivos. Usa la configuración server-only
existente de RAES API y `auth.admin.updateUserById` exclusivamente para el password.
No crea cuentas ni modifica perfil, rol, metadata o datos académicos. Comprueba que
el destino no cambió antes de actualizar, verifica un login con la nueva contraseña
y cierra esa sesión de comprobación. No imprime contraseñas, tokens ni errores
remotos sin sanitizar. No es un endpoint público de recuperación.

## Restablecimiento local de una contraseña ciudadana

Para una cuenta existente de Credenly, con autorización de su titular:

```bash
pnpm --filter @credenly/api citizen:reset-password --email cuenta@dominio --check
pnpm --filter @credenly/api citizen:reset-password --email cuenta@dominio
```

El comando requiere correo ya confirmado y perfil ciudadano existente. Solicita
contraseña y confirmación ocultas (12–256 caracteres), únicamente en terminal
interactiva; no usa argumentos/archivos/variables para la contraseña. Actualiza
solo el password de Auth, verifica login y cierra esa sesión de comprobación.
Comprueba que perfil y vinculación RAES permanecen iguales. No confirma correos,
crea identidades, altera datos académicos ni cambia permisos. Es una utilidad
operativa local, no un endpoint público de recuperación.
