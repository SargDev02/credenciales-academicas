# Sincronización académica base

Esta etapa introduce los primeros endpoints de escritura institucional sobre RAES.

La institución autenticada nunca envía un `institucion_id`. RAES obtiene la institución desde la integración autenticada.

## Endpoints

Todos requieren:

```http
Authorization: Bearer <client_id>.<client_secret>
Content-Type: application/json
```

### Institución

```text
PUT /api/v1/sync/institution
scope: institution:sync
```

El NIT del payload debe coincidir con la institución asociada a la integración. El endpoint no permite cambiar la identidad institucional hacia otra institución.

### Sedes

```text
PUT /api/v1/sync/campuses
scope: institution:sync
```

La clave natural en RAES es:

```text
institucion_id + codigo_origen
```

Enviar dos veces la misma sede actualiza la proyección existente en lugar de crear un duplicado.

### Programas

```text
PUT /api/v1/sync/programs
scope: institution:sync
```

La clave natural es:

```text
institucion_id + codigo_origen
```

### Personas

```text
PUT /api/v1/sync/persons
scope: persons:sync
```

RAES resuelve la identidad maestra mediante:

```text
tipo_documento + numero_documento
```

y conserva la referencia propia de la institución en `persona_fuentes`.

Si otra institución reporta posteriormente la misma identidad documental, RAES reutiliza la persona maestra y crea otra fuente institucional.

Si el mismo `identificadorOrigen` de una institución intenta cambiar a otro documento, RAES devuelve conflicto 409 en lugar de reasignar silenciosamente la identidad.

## Semántica PUT

Los payloads representan la fotografía actual del registro de origen. Los campos opcionales omitidos se normalizan a `null` en RAES.

## Fuera de alcance de esta subetapa

Todavía no se implementan:

- programa ↔ sede;
- credenciales;
- idempotencia HTTP de mutaciones;
- historial de credenciales;
- correcciones, revocaciones y anulaciones.

Esos componentes se agregan después de validar esta sincronización base.
