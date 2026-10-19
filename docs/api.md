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
