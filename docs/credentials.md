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


## Historial completo

`credencial_versiones` conserva ahora también `tipo` y `categoria`. Esto permite reconstruir completamente cada versión histórica y no solamente la proyección actual de `credenciales`.

La migración conserva la inmutabilidad histórica: el trigger de versiones se deshabilita únicamente durante el backfill controlado de las versiones existentes y queda habilitado nuevamente dentro de la misma migración.

## Correcciones

```text
POST /api/v1/credentials/corrections
scope: credentials:correct
```

Una corrección recibe:

- `codigoOrigen`;
- `motivo`;
- `ocurridoAt`;
- `datosActualizados` con una fotografía completa del contenido corregido.

La operación:

1. bloquea la credencial para evitar cambios concurrentes;
2. verifica que siga `VIGENTE`;
3. resuelve programa y sede dentro de la institución autenticada;
4. incrementa `version_actual`;
5. crea una nueva fila inmutable en `credencial_versiones`;
6. crea el evento `CORREGIDA`;
7. conserva la versión anterior sin modificarla.

## Revocación

```text
POST /api/v1/credentials/revocations
scope: credentials:revoke
```

Una revocación:

- cambia la proyección actual a `REVOCADA`;
- registra `revocada_at` y `motivo_revocacion`;
- crea una nueva versión con estado reportado `REVOCADA`;
- crea un evento `REVOCADA`.

Los datos académicos de la nueva versión se copian de la última versión vigente, por lo que el historial sigue siendo autocontenido.

## Anulación

```text
POST /api/v1/credentials/annulments
scope: credentials:annul
```

Una anulación:

- cambia la proyección actual a `ANULADA`;
- registra `anulada_at` y `motivo_anulacion`;
- crea una nueva versión con estado reportado `ANULADA`;
- crea un evento `ANULADA`.

## Estados terminales

`REVOCADA` y `ANULADA` son estados terminales en esta versión del dominio.

Por lo tanto:

```text
VIGENTE -> CORREGIDA -> VIGENTE
VIGENTE -> REVOCADA
VIGENTE -> ANULADA
```

No se permite corregir una credencial después de quedar revocada o anulada, ni transicionar una credencial terminal a otro estado.

Las tres operaciones de ciclo de vida usan los mismos headers de idempotencia que el registro inicial.
