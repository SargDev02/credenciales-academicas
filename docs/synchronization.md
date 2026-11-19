# Detección y revisión académica

Desde la activación del corte del 2026-11-09, los conectores detectan y presentan
propuestas. La escritura canónica requiere aprobación administrativa. Comandos,
contratos, baseline y operación en [revisión académica](academic-review.md).
`sync` es alias de detect-and-submit; las rutas de escritura descritas abajo
son HISTÓRICAS y ahora responden409 ACADEMIC_REVIEW_REQUIRED. No usarlas para
incorporar datos ni para programar sincronización automática.

## Referencia histórica anterior al corte

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


## Cuándo llega un cambio a la web

Los conectores actuales son comandos de una sola ejecución: leen la fuente,
detectan cambios, presentan propuestas y terminan. Iniciar RAES API/las webs no inicia los conectores. El
repositorio no configura un worker, tarea periódica o suscripción a cambios de las
bases institucionales. Una edición en Supabase no se envía automáticamente a RAES.

Desde la raíz, con RAES API activa en el origen configurado y los `.env.local`
server-side de cada conector preparados:

```bash
pnpm --filter @raes/connector-poli sync
pnpm --filter @raes/connector-udea sync
```

Estos comandos registran observaciones/propuestas por RAES API; no escriben
el estado académico canónico. Puede limitarse la detección al código institucional
con `detect -- --credential-code=<codigo>`.
No ejecutar dos procesos concurrentes para una misma fuente.

La secuencia esperada para una credencial administrada y VIGENTE en RAES es:
cambiar el origen, ejecutar detección y comprobar la propuesta PENDIENTE.
RAES Admin debe aprobarla antes de que la siguiente consulta web muestre el cambio.
Mientras esté pendiente o si se rechaza, se conserva el contenido aprobado.
RAES conserva versiones/eventos y los detectores reportan `canonicalWrites: 0`.
Credenly consulta RAES por HTTP con `cache: no-store`; no lee las bases
institucionales ni mantiene snapshots académicos. Una pestaña ya abierta necesita
una nueva consulta (recargar); no recibe cambios por push.

Si un cambio no aparece, revisar el resumen del conector:

- `existingCredentialsNotAdopted`: alta legacy o de otra operación; preservación
  deliberada, sin corregir ni adoptar el registro automáticamente.
- `terminalStateConflicts`: RAES ya tiene un estado terminal incompatible; no
  reactivar ni corregir una credencial revocada/anulada desde una edición de origen.
- `credentialsCorrected`/`credentialsUnchanged`: reconciliación de contenido propio.
- Fallo HTTP/validación: no asumir que la ejecución terminó correctamente.

El [diagnóstico de 2026-10-19](reports/institution-sync-diagnosis.md) distingue
el envío manual del caso legacy histórico observado, sin modificar datos académicos.


## Reconciliación vigente con el quality gate

Los comandos `sync` se conservan solo como alias de detección; no aplican datos
académicos. No existen los antiguos modos `--only`, `sync:base` o
`sync:credentials`. Usar `detect` para presentar propuestas. La aceptación o
rechazo pertenece a RAES Admin. No volver a generar los cortes existentes de
47/97 huellas (144 total) ni repetir fixtures o aprobaciones remotos al integrar Git.
