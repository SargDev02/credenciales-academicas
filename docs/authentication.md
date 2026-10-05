# Autenticación institucional

## Objetivo

Cada conector institucional se autentica contra RAES API sin tener acceso directo a la base de datos de RAES.

## Credencial

La cabecera HTTP usa el formato:

```http
Authorization: Bearer <client_id>.<client_secret>
```

El `client_id` identifica la integración. El `client_secret` es un valor aleatorio de alta entropía.

## Almacenamiento

RAES nunca almacena el secreto en texto plano.

```text
client_secret
     ↓
SHA-256
     ↓
secret_hash
```

También se conserva un prefijo corto para localizar el secreto correspondiente sin guardar el valor completo.

El secreto original se muestra únicamente cuando se genera.

## Estados

Una integración debe estar en estado `ACTIVA`.

Un secreto:

- no puede estar revocado;
- no puede estar vencido;
- debe coincidir con el hash almacenado.

## Scopes iniciales

- `institution:sync`
- `persons:sync`
- `credentials:create`
- `credentials:correct`
- `credentials:revoke`
- `credentials:annul`
- `credentials:read`

Una ruta puede exigir uno o más scopes. Una credencial válida sin el scope requerido obtiene HTTP 403.

## Institución A

Durante el desarrollo, el comando:

```bash
pnpm --filter @raes/api bootstrap:institution-a
```

registra, si todavía no existen:

1. el catálogo de scopes;
2. el Politécnico en RAES;
3. su integración;
4. las relaciones de scopes;
5. un secreto inicial.

El comando es idempotente respecto a la institución e integración y no genera un nuevo secreto si ya existe uno activo.

## Endpoint de prueba

```text
GET /api/v1/auth/whoami
```

requiere autenticación institucional y devuelve únicamente identidad de integración y scopes. Nunca devuelve hashes ni secretos.
