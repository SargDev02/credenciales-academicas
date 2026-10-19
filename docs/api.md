# RAES API

RAES API es el punto de entrada de las integraciones institucionales y el punto de consulta académica autorizado para Credenly.

## Base URL de desarrollo

```text
http://localhost:3001/api/v1
```

## Health

### `GET /health`

Comprueba que el proceso HTTP está funcionando. No depende de Supabase.

### `GET /health/ready`

Comprueba que la configuración del servicio es válida y que RAES API puede consultar su proyecto Supabase.

## Seguridad de conexión

La `RAES_SUPABASE_SERVICE_ROLE_KEY`:

- solo existe en el entorno del servidor RAES API;
- nunca se envía al navegador;
- nunca se comparte con conectores institucionales;
- nunca se comparte con Credenly;
- nunca se guarda en Git.

Las integraciones institucionales usan credenciales propias de RAES API.

## Operaciones disponibles

| Consumidor | Rutas principales |
| --- | --- |
| Institución | `PUT /sync/institution`, `/sync/campuses`, `/sync/programs`, `/sync/program-campuses`, `/sync/persons` |
| Institución | `POST /credentials`, `/credentials/corrections`, `/credentials/revocations`, `/credentials/annulments` |
| Institución | `GET /credentials/source/{code}` (`credentials:read`, solo su institución) |
| Cliente API | `POST /persons/resolve`, `GET /persons/{personId}/credentials` |
| Administración | `/admin/institutions`, `/admin/institutions/{institutionId}/integrations`, `/admin/api-clients` |

Los cuerpos JSON se limitan a 64 KiB de bytes reales, incluso sin `Content-Length`.
JSON inválido devuelve 400 y exceso de tamaño 413; los errores no reflejan el cuerpo
ni detalles SQL. Las operaciones de credenciales conservan sus headers de idempotencia.
Los detalles de scopes, roles y auditoría están en `docs/authentication.md`.

## Introspección administrativa

### `GET /api/v1/admin/me`

Requiere JWT de Supabase Auth RAES mediante `Authorization: Bearer <JWT>`.
Reutiliza `authenticateAdmin(request, ["SUPERADMIN", "ADMIN", "AUDITOR"])`;
no modifica los roles por defecto ni otorga permisos de escritura.

```json
{"data":{"id":"uuid","nombres":"Nombre","apellidos":"Apellido","rol":"AUDITOR","estado":"ACTIVO"}}
```

Solo devuelve esos cinco campos del perfil administrativo validado. No devuelve
email, tokens, metadata de Auth ni secretos. Respuesta `Cache-Control: private, no-store`.

- 200: sesión válida y perfil ACTIVO con rol SUPERADMIN, ADMIN o AUDITOR.
- 401: Bearer ausente, inválido o sesión expirada.
- 403: sin perfil administrativo activo o rol no admitido.
- 500: fallo interno de consulta, con error sanitizado.

Las rutas de altas conservan su autorización independiente: AUDITOR recibe 403.
La UI consulta esta introspección en el servidor; no accede a `perfiles_admin`.

## Credenly Admin — consultas operativas

Estos endpoints pertenecen a **Credenly API**, no a RAES. Requieren bearer del Auth
Credenly + perfil administrativo ACTIVO/ADMIN_CREDENLY por UUID. No autorizan por
correo o metadata. Todas las respuestas llevan `Cache-Control: private, no-store`.
No hay endpoints administrativos de escritura en este alcance.

| Método/ruta | Respuesta `data` |
| --- | --- |
| GET `/api/v1/admin/me` | `{id,nombres,apellidos,rol:"ADMIN_CREDENLY",estado:"ACTIVO"}` |
| GET `/api/v1/admin/overview` | `observedAt`, profiles/verifications/links/shares `{total,byState}`, incidents y `incidentSource:"auditoria_admin"` |
| GET `/api/v1/admin/users?page=1` | `{page,pageSize:20,hasMore,items:[{id,emailConfirmed,createdAt,lastSignInAt}]}` |
| GET `/api/v1/admin/health` | `{checkedAt,httpStatus:200|503,status:"ready"|"not_ready",components:{database,auth,raes}}` |

Overview cuenta las tablas ciudadanas, sin proyectar sus registros. Documentales:
PENDIENTE/PROCESADA/APROBADA/RECHAZADA/REVISION; vínculos:
PENDIENTE/VERIFICADA/RECHAZADA/REVOCADA; perfiles:
PENDIENTE_VERIFICACION/ACTIVO/SUSPENDIDO/CERRADO. Shares:
ACTIVA/REVOCADA/EXPIRADA (revocación tiene precedencia). Conteos independientes,
no un snapshot transaccional ni una serie histórica.

Incidentes: hasta diez lecturas administrativas con resultado ERROR, proyectando
solo id/action/result/occurredAt. No contiene errores generales de Auth/OCR/RAES
ni texto interno. `users` usa Auth Admin solo desde backend y omite email, metadata,
hashes y sesiones. Página entera 1–9999; una página completa permite consultar la
siguiente sin afirmar que haya registros. Página inválida: 400 `INVALID_PAGE`.

Health reutiliza el verificador existente; nunca consulta RAES DB. HTTP del wrapper
es 200 si la lectura y su auditoría finalizaron, incluso cuando el readiness
proyectado sea 503/not_ready. Auth `configured` solo indica configuración requerida
presente. Los fallos inesperados se sanitizan.

Comunes: 401 sin token o inválido; 403 sin perfil/rol/estado autorizado; 503 ante
fallo de validación, consulta operativa o auditoría. El guard se ejecuta antes de
consultar datos y no amplía permisos ciudadanos. Una cuenta con perfil admin activo
o inactivo recibe 403 en los endpoints ciudadanos protegidos.

Cada lectura autorizada registra actor, acción, EXITO/ERROR, fecha y recurso mínimo.
Si el registro falla, no se entrega el resultado y se responde 503. Denegaciones sin
actor administrativo válido no generan perfiles ni filas de auditoría ficticias.
No se exponen tokens, identidad RAES, documentos ni credenciales académicas.
