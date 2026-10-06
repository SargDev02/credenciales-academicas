# Credenly API

Backend independiente de Credenly.

## Responsabilidades

- validar sesiones de Supabase Auth de Credenly;
- administrar el perfil ciudadano;
- orquestar verificación de identidad;
- conservar únicamente la vinculación verificada con una persona de RAES;
- consultar credenciales académicas siempre en vivo mediante RAES API;
- administrar comparticiones y verificaciones públicas.

## Regla de almacenamiento

Credenly **no almacena credenciales académicas ni copias persistentes de su estado**.

Puede conservar referencias externas como `raes_persona_id` y `raes_credencial_id`, además de datos propios de autenticación, verificación, compartición y auditoría.

## Desarrollo local

Copia:

```bash
cp services/credenly-api/.env.example services/credenly-api/.env.local
```

Completa localmente:

```text
CREDENLY_SUPABASE_URL
CREDENLY_SUPABASE_SERVICE_ROLE_KEY

RAES_API_BASE_URL=http://localhost:3001
RAES_CREDENLY_CLIENT_ID
RAES_CREDENLY_CLIENT_SECRET
```

Nunca confirmes secretos reales en Git.

Ejecuta:

```bash
pnpm --filter @credenly/api dev
```

Puerto local:

```text
http://localhost:3002
```

## Endpoints implementados

```text
GET /api/v1/health
GET /api/v1/health/ready

GET /api/v1/auth/me
Authorization: Bearer <supabase_access_token>

GET /api/v1/profile
PUT /api/v1/profile
Authorization: Bearer <supabase_access_token>

GET  /api/v1/raes/link
POST /api/v1/raes/link
Authorization: Bearer <supabase_access_token>

GET /api/v1/credentials
Authorization: Bearer <supabase_access_token>
```

`POST /api/v1/raes/link` no acepta número de documento directamente. Recibe el ID de una verificación de identidad que ya debe estar en estado `APROBADA`. Credenly toma la identidad extraída de esa verificación, resuelve la persona mediante RAES y confirma la vinculación de forma transaccional.

`GET /api/v1/credentials` requiere una vinculación RAES en estado `VERIFICADA` y consulta las credenciales en vivo mediante RAES API. La respuesta declara `persistedByCredenly: false` para reforzar que Credenly no almacena copias académicas.

## Estado actual

La base de Credenly ya contiene:

- `perfiles`;
- `verificaciones_identidad`;
- `vinculaciones_raes`;
- `comparticiones`;
- `accesos_compartidos`.

La autenticación de servicio Credenly -> RAES ya está implementada. El siguiente paso es conectar el flujo de OCR/verificación de identidad con `POST /api/v1/raes/link` y validar la consulta ciudadana de credenciales de extremo a extremo.
