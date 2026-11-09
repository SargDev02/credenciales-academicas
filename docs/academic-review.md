# Revisión académica supervisada

Las instituciones reportan; ADMIN/SUPERADMIN deciden; Credenly consulta el último
estado aprobado actualmente en RAES. «En tiempo real» no significa leer datos
institucionales pendientes. No se usan WebSockets, cron remoto ni despliegues.

## Activación y estado restaurado

Trabajo en `feat/raes-academic-review`, desde `main` 09e9775, separado del PR #16.
Primero se reconectaron y verificaron RAES `askqizcwemmydwcgrewp` y Credenly
`xvzylegwuxmxqcgdjjrq`; [informe de reconexión](reports/supabase-reconnection-2026-11-09.md).
Las fuentes siguen siendo Poli `fswppckzhvpcbybslnop` y UdeA `taoapbewllieuephaxsy`.

El catálogo restaurado se comparó semánticamente con el DDL histórico: las diez
migraciones de cada proyecto ya estaban presentes. No se ejecutó `repair`,
`db push`, reset ni DDL histórico otra vez.

| Migración nueva | Clasificación y operación | Registro remoto |
| --- | --- | --- |
| academic_review | PENDIENTE Y NECESARIA; timestamp local previo REQUIERE RECONCILIACIÓN, solo esta versión nueva se renombró al registrarla | 20261109161812 |
| academic_review_preserve_unchanged_catalogs | Corrección necesaria: no cambiar updated_at de catálogos reutilizados sin diferencias | 20261109162351 |

Ambas pasaron un ensayo remoto con ROLLBACK antes de registrarse. Se compararon
huellas de once tablas canónicas antes/después: ninguna fila cambió. La segunda
migra solo la función privada de aplicación; la primera ya aplicada permanece
inmutable. Evidencias en `reports/evidence/academic-review-*.json`.

## Baseline explícito

Desde la raíz:

```bash
pnpm --filter @raes/api academic-review:baseline -- --check
pnpm --filter @raes/api academic-review:baseline
```

`--check` hace únicamente GET y funciona antes de instalar el esquema nuevo.
Resuelve cada institución por NIT e integración configurada; nunca por un UUID
institucional incrustado. Carga ambas fuentes y compara identidad documental,
fuentes, credenciales/persona y referencias de programa/sede/oferta con RAES nuevo.
Cualquier desconocido aborta antes de crear cortes. Cada RPC repite su preflight
bajo bloqueo de institución. Máximo 10.000 observaciones/4 MiB por corte.

El corte se aplica una vez por institución, no se sobrescribe. Si la segunda RPC
falla, la primera conserva su corte: revisar el resultado y reanudar explícitamente,
sin borrar ni recalcular huellas originales. No hay transacción distribuida con
las fuentes; la exclusión cubre RAES, y se debe evitar edición concurrente de las
fuentes durante la activación.

Corte aplicado sobre las fuentes actuales **antes del fixture de esta fase**:

| Institución | Estudiantes | Credenciales | Programas | Sedes | Relaciones | Huellas |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Poli | 13 | 13 | 7 | 3 | 11 | 47 |
| UdeA | 18 | 18 | 13 | 13 | 35 | 97 |

Total 144, cero desconocidos y cero solicitudes iniciales. El corte congela hashes,
source_updated_at, identificador de origen, fechas y referencias RAES. No contiene
copias de documentos ni payloads académicos. `huellas_baseline_revision_academica`
es inmutable; `origenes_revision_academica` mantiene la cabeza posterior separada.
Las personas y credenciales preexistentes no se reaprobaron ni modificaron.

El baseline reconoce el contenido institucional observado, incluso si difiere de
la proyección histórica RAES. No afirma que ambos contenidos fueran iguales ni
aplica diferencias antiguas silenciosamente. Solo una observación posterior con
contenido distinto inicia revisión. Esto resuelve genéricamente el caso legacy:
no se adopta una creationKey histórica ni se elimina/recrea una credencial.

## Detector y contratos

```bash
pnpm --filter @raes/connector-poli detect
pnpm --filter @raes/connector-udea detect
pnpm --filter @raes/connector-poli detect -- --credential-code=CODIGO
```

`sync` queda como alias compatible de **detectar y proponer**, sin escritura
canónica. `--only=base/all/credentials` ya no está admitido. Se valida toda la
fuente seleccionada antes del primer submit. El filtro conserva el grupo completo
del estudiante: no separa artificialmente sus credenciales dependientes.

`packages/connector-core` comparte lecturas paginadas (1.000 filas), mapeo y runner.
El lease se obtiene **antes de leer la fuente** y se libera en finally con éxito
COMPLETADA o ERROR. Salida JSON con observaciones/propuestas/canonicalWrites:0;
fallos con exit 1 y diagnóstico estático sin datos privados. Ningún modo aprueba.

Un lease persistente por institución vence a los 120 s; cada submit válido lo
renueva. Otro proceso recibe 409. Un UUID de fencing impide que un proceso antiguo
publique o cierre un lease posterior. Si leer la fuente excede 120 s, falla cerrado:
no hay renovación fuera de submit ni reintento automático. Aumentar/monitorizar
ese límite al programar fuentes mayores es trabajo operativo posterior.

Los cuatro tipos son NUEVO_ESTUDIANTE, ACTUALIZACION_ESTUDIANTE, NUEVA_CREDENCIAL
y ACTUALIZACION_CREDENCIAL. Una persona nueva incluye todas sus credenciales en
una sola revisión y transacción. Una persona ya conocida genera propuestas
independientes para sus datos y cada credencial. Cambios de catálogo relevantes
viajan dentro de las credenciales afectadas; no hay tipo de revisión independiente
para un catálogo sin credenciales ni para metadatos de institución.

Zod estricto valida request/response, referencias, estados, fechas y decisiones.
Máximo 50 credenciales por observación, 64 KiB JSON por petición. No se acepta
institucion_id, estado de revisión, actor ni decisión en un submit. Se deriva la
institución del actor autenticado. No se confía solo en tipos TypeScript.

## Fingerprints, deduplicación y estados

SHA-256 sobre JSON canónico con claves ordenadas (collation C), envelope de
institución + entidad + identificador origen + contenido. Null opcionales se
normalizan, arrays de credenciales se ordenan por origen; sourceUpdatedAt queda
fuera del contenido. La huella cambia por datos académicos, no por un timestamp
sin cambio. Vectores SQL y JavaScript comprueban la misma serialización.

- Mismo contenido que la cabeza actual: sin nueva solicitud, versión ni evento.
- PENDIENTE A → nuevo B: A queda SUPERSEDIDA; B ocupa la única cabeza pendiente.
- RECHAZADA + mismo contenido: no reaparece. Corregir contenido permite otra revisión.
- A → B → A: episodio nuevo; no se confunde con un hash histórico de otro episodio.
- source_updated_at anterior al último conocido se rechaza cuando ambos existen.
  Una fuente sin timestamp no aporta prueba de orden; se conserva el orden recibido.
- Una fila institucional conocida no puede reasignarse a otro código de credencial.

Un índice parcial impone una pendiente por origen, la secuencia diferencia
los episodios y las FK relacionan supersedes/superseded_by. El fingerprint canónico
capturado se vuelve a comparar al aprobar: un cambio aprobado entre detección y
revisión produce 409 CANONICAL_CHANGED. Una nueva detección reemplaza la comparación
obsoleta, incluso si la institución envía el mismo contenido propuesto.

## API y autorización

| Método/ruta bajo `/api/v1` | Actor |
| --- | --- |
| POST `academic-review/detections` | Integración activa + academic-review:submit |
| DELETE `academic-review/detections` | Misma integración y deteccionId |
| POST `academic-review/proposals` | Misma integración, lease y observacion |
| GET `admin/academic-reviews` | ADMIN / SUPERADMIN / AUDITOR activos |
| GET `admin/academic-reviews/[id]` | Mismos roles de lectura |
| POST `admin/academic-reviews/[id]/approve` | ADMIN / SUPERADMIN activos |
| POST `admin/academic-reviews/[id]/reject` | ADMIN / SUPERADMIN activos |

Filtros estado/tipo/institucion/desde/hasta/q, page 1–10.000, pageSize 1–100
(default20). Búsqueda por origen/código con caracteres permitidos y SQL parametrizado;
no busca documentos/nombres. Fechas calendario en America/Bogota, hasta inclusivo.
No se admiten parámetros desconocidos o duplicados.

Approve acepta motivo opcional con default administrativo; reject lo exige,
3–1.000 caracteres. UUID de admin viene de authenticateAdmin. La RPC revalida el
perfil ACTIVO/rol dentro de la transacción. AUDITOR e institución reciben 403;
ninguna ocultación de botones sustituye esta autorización.

Respuestas privadas `Cache-Control: private, no-store`; 401 sin sesión, 400/413 por
payload, 403 permisos, 404 no disponible, 409 stale/terminal/lease/corte/identidad,
503 ante fallo inesperado. Sin SQL, tokens ni payloads privados en errores/logs.
El detalle muestra una proyección actual/propuesta; el listado omite documentos
y payload completo. Solo administradores autenticados pueden acceder al detalle.

## Transacciones y protección de rutas antiguas

La decisión adquiere bloqueo advisory por institución, bloquea perfil/cabeza/solicitud
y exige READ COMMITTED para no aprobar un snapshot anterior a la espera. La creación
maestra comparte un bloqueo adicional por tipo/número documental entre instituciones.
Persona, fuente, credencial, versiones, eventos, operación idempotente, cabezas,
decisión y auditoría se confirman juntos. Cualquier error revierte todo.
Aprobación repetida devuelve replayed sin otra mutación; rechazo repetido con
el mismo motivo es idempotente. Decidir una supersedida/revisada incompatible da409.

Se reutilizan las RPC históricas de creación/corrección/transición como funciones
internas del owner; sus permisos de ejecución service_role se revocan. Las nueve
rutas institucionales antiguas de sync/create/correct/revoke/annul responden409
ACADEMIC_REVIEW_REQUIRED tras autenticar. Triggers bloquean escritura canónica
incluso desde una API antigua que use service_role; no basta enviar un GUC con un
UUID aprobado. El guard verifica el owner ejecutando la RPC y el contexto de decisión.
TRUNCATE se revoca para browser y service_role. RLS en las cinco tablas nuevas,
sin grants browser ni ejecución browser de RPC. Las escrituras de revisión solo
entran por RPC; service_role dispone de SELECT para inspección server-only.

REVOCADA y ANULADA conservan su historial y no se reactivan/corrigen por este flujo.
La propuesta sigue siendo visible pero bloqueada REQUIERE_DECISION; puede rechazarse.
No se inventó transición terminal inversa. Actualizaciones de credencial conservan
UUID/código/historia, añadiendo versión/evento solo al aprobar. Catálogos reutilizados
sin diferencias conservan filas y timestamps.

## Web y lecturas de Credenly

RAES Web agrega `/validations`, detalle y contador real en dashboard. Filtros por
GET, paginación, loading, empty, errores 403/404/409, estados terminales y supersedida.
El detalle compara campos seguros, indica diferencias con texto y color, muestra
incorporaciones agrupadas y motivos. Diálogos nativos con confirmación explícita,
rechazo obligatorio, bloqueo de doble envío, foco/Escape y refresh de estado.
AUDITOR solo lee. Sin polling ni librería UI adicional.

Server Components para datos; solo navegación y decisiones usan cliente. Botones,
inputs, tarjetas y badges compactos del diseño existente, sin cambiar Figma.
Comparación con scroll local accesible por teclado; filtros fluidos 360/768/1024/1440,
sin overflow de documento. Screenshots revisados con fixtures exclusivamente locales.

Credenly autentica ciudadano, consulta su vínculo y hace una petición real a RAES
API por cada GET. No conoce tablas de revisión ni bases institucionales. `no-store`
en fetch y `force-dynamic` en ambas rutas; headers privados también en errores.
React cache solo deduplica dentro del render web; no hay ISR/snapshot académico.
La prueba local usa PostgreSQL real en WASM + ambas APIs construidas + RAES Web:
A permanece mientras B está pendiente, y el siguiente GET tras aprobar devuelve B.
Mantiene source RAES / persistedByCredenly false; cero escrituras académicas Cred.

## Auditoría y operación futura

ACADEMIC_REVIEW_BASELINED/SUBMITTED/SUPERSEDED/READ/APPROVED/REJECTED conservan actor,
recurso y metadata mínima (tipo, secuencia, paginación, institución o corte).
No guardan documento, payload completo, motivo privado duplicado, JWT ni secretos.
El actor UUID de la decisión permanece como referencia histórica aunque se retire
una cuenta Auth de prueba, sin FK destructiva sobre el historial académico.

El comando detect puede ejecutarse periódicamente en el futuro, con el mismo
lease/fencing y exit codes. Aún no se configura cron, servicio externo ni despliegue.
No automatizar aprobación; intervalos/alertas/retención se deciden al preparar operación.

## Validación y límites

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm -r --if-present build
pnpm test:academic-review:browser
pnpm test:frontend:browser
node scripts/verify-web-boundaries.mjs
```

PGlite 0.5.8 es solo dev y fue autorizado. Reconstruye DDL histórico mínimo por SHA,
migraciones main y las nuevas en orden; Auth/roles son un soporte local mínimo.
No exporta esquemas internos Supabase ni reemplaza ensayo de recuperación completo,
pruebas de carga o concurrencia entre conexiones PostgreSQL independientes.

Lint ahora es ESLint real central en raíz, sin copiar CI/config Next del PR #16.
No hay scripts lint por paquete ni reglas específicas de Next/React/hooks o análisis
type-aware; typecheck es una comprobación separada. Node de esta validación:26.10.0,
pnpm12.8.1. No afirmar validación de otra versión por un PATH inexistente.

La prueba remota sintética tiene autorización separada y manifest/SQL en
`supabase/fixtures/academic-review/`; nunca reejecutar ante colisión. El operador
`verify-academic-review-live.mjs` exige contraseña admin actual oculta; no resetea
cuentas existentes y detiene ante limpieza fallida. Ver su evidencia final separada.
Se mantiene fuera del alcance producción: autenticidad/identidad real, recuperación,
operación/retención/rotación, contraseñas filtradas y gate/CI del PR #16.

## Evidencia de calidad posterior a reconexión

- `pnpm lint`: ESLint real, cero errores/warnings.
- `pnpm typecheck`: todos los workspaces correctos.
- `pnpm test`: 270/270 (245 de paquetes + 25 SQL), sin skips. Incluye
  reconstrucción limpia, legado, rollback, deduplicación, terminales, guard,
  timestamps, cambios canónicos posteriores y comparación actual/propuesta.
- Builds de ambos frontends, ambas APIs y contratos: correctos.
- Playwright previo: 20/20; revisión académica nueva: 6/6. Prueba integrada
  local con las funciones SQL reales, APIs construidas y RAES Web, no solo mocks
  de pantalla. Auth/transporte Supabase sí se sustituyen localmente.
- `verify-web-boundaries`: 388 archivos / 39 bundles, cero secretos backend o
  claves privadas, cero persistencia manual de sesión. Revisión adicional de
  todos los archivos versionables contra los secretos reales locales: cero.
- Postcheck remoto: RLS en todas las tablas públicas, cero grants de tabla/columna
  browser, cero ejecución de RPC de revisión para anon/authenticated. Advisors
  security: solo INFO por RLS sin policy en tablas server-only y WARN HIBP
  deshabilitado (decisión operativa ya conocida). No se abren policies ni servicios pagos.

Las detecciones reales completas posteriores al corte devolvieron 0 propuestas:
Poli 13 personas/13 credenciales, 26 observaciones iguales; UdeA 18/18, 36 iguales.
Ambas canonicalWrites:0. Esto comprueba el corte actual sin reaprobar registros.
La prueba remota completó incorporación, OCR/vinculación y HTTP ciudadano
A→pendiente→B aprobado con200 y sin snapshots. El operador se detuvo en su último
bloque de observación de idempotencia, con limpieza completa confirmada; se
conserva el artefacto FAIL y no se afirma que ese proceso terminara con exit0.
El postcheck independiente terminó PASS: repetición de detector sin propuestas,
replay RPC/service_role en ROLLBACK y once huellas canónicas sin cambios; confirma
también cero usuarios/identidades/sesiones/relaciones temporales. El replay HTTP
se prueba localmente. La causa exacta del fallo final del operador no se reprodujo
y queda como limitación de la herramienta, con diagnóstico por etapas ampliado.

Exclusión comprobada también sobre RAES PostgreSQL remoto: dos peticiones HTTP
de inicio simultáneas devolvieron200 y409, cierre del lease200; ningún canónico
cambió y no apareció ninguna solicitud. Se verificó service_role sin EXECUTE en
las tres RPC históricas de mutación. Evidencia `academic-review-real-exclusion.json`.
Esto no sustituye una prueba de carga ni todas las carreras de aprobación.

## Primer intento remoto y reanudación

La incorporación sintética real sí pasó: tres filas nuevas en Poli, propuesta
agrupada pendiente sin escritura canónica, aprobación por API admin y persona
`77cf8d08-fd62-42ac-94bf-404a653b7fec`. La fase ciudadana detectó un fallo del
parser OCR: extraía MBRES desde NO dentro de NOMBRES, aunque Tesseract leía el
identificador correctamente. El operador se detuvo antes de vincular y eliminó
la cuenta temporal y sus relaciones. Todos los registros previos conservaron sus
huellas. No se borró el historial nuevo aprobado.

El propietario autorizó un fix genérico de etiquetas completas, sin bajar
thresholds ni añadir excepciones. Ocho regresiones nuevas y Tesseract real
confirman el identificador correcto. Ver propuesta autorizada y evidencia de
primer intento/diagnóstico en `reports/evidence/academic-review-*`.

```bash
pnpm --filter @raes/api exec node scripts/verify-academic-review-live.mjs --resume --check
pnpm --filter @raes/api exec node scripts/verify-academic-review-live.mjs --resume
```

Resume exige la evidencia del intento anterior, limpieza confirmada, misma
aprobación/UUID de persona, misma credencial VIGENTE v1/títuloA, tres filas fuente
exactas y cuenta temporal ausente. No ejecuta SQL de creación. Los checks excluyen
únicamente la credencial sintética autorizada que cambiará A→B; el resto, incluido
su historial v1 y sus filas de persona/fuente, permanece protegido.

## Resultado remoto final

Dos solicitudes APROBADA, cero pendientes; una persona nueva, una fuente y una
credencial nuevas. Totales RAES31personas/32fuentes/33credenciales,41versiones,
eventos y operaciones. La segunda ejecución global de ambos detectores devuelve
cero novedades: Poli14/14 (28observaciones iguales), UdeA18/18 (36iguales).

Credencial3611d73f-e7bc-47a9-96cc-45e77ac47dc7 / RAES-CRD-00000033, VIGENTE v2,
procede de Poli. Los dos intentos temporales de Credenly quedaron eliminados:
Auth/identidades/sesiones/perfil/verificación/vínculo/comparticiones en cero para
sus UUID; originales4Auth/1perfil/1verificación/1vínculo/5shares/9accesos intactos.
La cuenta administrativa y Valentina se conservan. Fixture permanente y cambios
exactos en [su manifest](../supabase/fixtures/academic-review/README.md).

Comprobador final sin nuevas cuentas ni contraseña:
`pnpm --filter @raes/api exec node scripts/verify-academic-review-postcheck.mjs`.
No repetir creación/resume: el dataset ya está en B. La revisión académica queda
funcionalmente validada para el prototipo; sin declaración de producción.
