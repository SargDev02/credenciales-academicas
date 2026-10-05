# Registro y versionado de credenciales

## Endpoint inicial

```text
POST /api/v1/credentials
scope: credentials:create
```

Headers obligatorios:

```http
Authorization: Bearer <client_id>.<client_secret>
Content-Type: application/json
X-Request-Id: <uuid>
Idempotency-Key: <clave estable de la operación>
```

## Idempotencia

RAES calcula un SHA-256 de una representación JSON canónica del tipo de operación y del payload validado.

Reglas:

```text
misma integración
+ misma Idempotency-Key
+ mismo hash
= devuelve el resultado ya creado

misma integración
+ misma Idempotency-Key
+ hash diferente
= HTTP 409
```

El header de respuesta `Idempotency-Replayed` indica si RAES creó la credencial o reutilizó el resultado anterior.

## Transacción

El registro inicial se ejecuta mediante la función PostgreSQL:

```text
registrar_credencial_inicial(...)
```

La función realiza en una sola transacción:

1. valida la integración;
2. resuelve la persona por `persona_fuentes`;
3. resuelve programa y sede dentro de la institución autenticada;
4. crea `operaciones_api`;
5. crea `credenciales`;
6. crea `credencial_versiones` versión 1;
7. crea el evento `REGISTRADA`;
8. marca la operación como `COMPLETADA`.

Si cualquiera de estos pasos falla, PostgreSQL revierte toda la transacción.

## Identificadores externos

La institución no envía UUID internos de RAES.

Usa:

- `personaIdentificadorOrigen`;
- `programaCodigoOrigen`;
- `sedeCodigoOrigen`;
- `codigoOrigen` de la credencial.

RAES resuelve internamente todos sus UUID.

## Estado inicial

Toda credencial nueva queda inicialmente:

```text
estado_actual = VIGENTE
version_actual = 1
evento = REGISTRADA
```

Correcciones, revocaciones y anulaciones se implementan como operaciones posteriores y nunca sobrescriben silenciosamente el historial.
