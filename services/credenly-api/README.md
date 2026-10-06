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
```

## Estado actual

La base de Credenly ya contiene:

- `perfiles`;
- `verificaciones_identidad`;
- `vinculaciones_raes`;
- `comparticiones`;
- `accesos_compartidos`.

La siguiente parte requiere una autenticación de servicio Credenly -> RAES para resolver identidad y consultar credenciales sin dar acceso directo a la base RAES.
