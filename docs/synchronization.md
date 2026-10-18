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

## Extensiones implementadas

Programa-sede, registro idempotente, versiones, correcciones, revocaciones y
anulaciones ya forman parte del backend. Los conectores usan los contratos y rutas
compartidos; la evidencia real y escenarios pendientes se mantienen en `progress.md`.

## Reconciliación de conectores

`GET /api/v1/credentials/source/{code}` requiere autenticación institucional y
`credentials:read`. Filtra siempre por la institución de la integración; no acepta
un ID de institución del consumidor. Devuelve la proyección vigente, referencias
locales de persona y clave de la operación de alta propia. Otra institución obtiene
404. No permite utilizar credenciales de clientes API ciudadanos en esta ruta.

Ambos conectores usan `@raes/connector-core`. Conservar la clave histórica de alta
permite reconocer registros propios sin adoptar operaciones ajenas. La comparación
contra la proyección vigente corrige la secuencia contenido A -> B -> A; comparar
solo contra el hash del alta original no detectaba la última vuelta a A.
Las claves de corrección incluyen versión observada y contenido; reintentos tras
una respuesta perdida vuelven a leer el estado y no crean otra versión si ya coincide.

Esta lectura no cambia el control transaccional de las RPC existentes. La fuente
no debe ejecutar dos procesos concurrentes con fotografías distintas de la misma
credencial; falta una política explícita de orden para ese caso antes de producción.
