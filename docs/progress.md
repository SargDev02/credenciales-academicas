# Progreso

Estado al 2026-10-18: **backend funcionalmente cerrado para el alcance del prototipo**.
Auditoría, conectores A/B, C/D multiinstitución, hardening y revisión técnica validados.
La ruta ciudadana HTTP real recupera ambas credenciales; la cuenta sintética temporal
se eliminó completamente. La legacy se preserva por decisión explícita. **No listo
para producción**: los cinco pendientes de producción se mantienen separados abajo.
Se inició la Foundation frontend y la primera RAES Web de lectura; las altas por
rol esperan aprobación de la consulta de identidad administrativa. Sin despliegues.

## Etapa 0 — Infraestructura de datos
- [x] Institución A.
- [x] Institución B.
- [x] RAES.
- [x] Credenly.
- [x] RLS inicial.

## Etapa 1 — Fundación del repositorio
- [x] Repositorio privado desde cero.
- [x] Monorepo definido.
- [x] TypeScript base.
- [x] Variables de entorno documentadas sin secretos.
- [x] Arquitectura documentada.
- [x] ADRs iniciales.
- [x] Contratos Zod compartidos.

## Etapa 2 — Institución A -> RAES
- [x] RAES API.
  - [x] Servicio base y health checks.
  - [x] Cliente Supabase server-side.
  - [x] Conexión local con RAES verificada.
- [x] Autenticación institucional y scopes.
  - [x] Formato Bearer y hashing implementados.
  - [x] Validación de scopes implementada.
  - [x] Bootstrap de Institución A implementado.
  - [x] Bootstrap probado contra RAES.
  - [x] Endpoint autenticado `/auth/whoami` validado.
- [x] Idempotencia.
  - [x] Headers X-Request-Id e Idempotency-Key implementados.
  - [x] Hash canónico SHA-256 implementado.
  - [x] Protección transaccional y replay implementados en RAES.
  - [x] Idempotencia validada de extremo a extremo.
- [x] Conector Politécnico.
  - [x] Lectura aislada de la base Institución A implementada.
  - [x] Transformaciones a contratos RAES implementadas.
  - [x] Sincronización de institución, sedes, programas y programa-sede implementada.
  - [x] Sincronización de personas implementada.
  - [x] Registro y estados de credenciales implementados.
  - [x] Idempotencia del conector implementada sin escribir estado en la institución.
  - [x] Datos base validados realmente contra Institución A.
  - [x] Credencial real validada mediante el conector.
- [x] Sedes y programas.
  - [x] Endpoints autenticados implementados.
  - [x] Sincronización real validada con Institución A.
- [x] Resolución de personas.
  - [x] Resolución maestra por tipo + número de documento implementada.
  - [x] Fuente institucional por identificador de origen implementada.
  - [x] Resolución real validada con Institución A.
- [x] Registro/versionado de credenciales.
  - [x] RPC transaccional de registro inicial aplicada en RAES.
  - [x] Endpoint POST /api/v1/credentials implementado.
  - [x] Versión 1 + evento REGISTRADA implementados.
  - [x] Registro real validado con una credencial de Institución A.
- [x] Correcciones.
  - [x] Versionado completo con tipo y categoría.
  - [x] RPC transaccional de corrección aplicada en RAES.
  - [x] Endpoint de corrección implementado.
  - [x] Corrección real validada de extremo a extremo.
- [x] Revocaciones/anulaciones.
  - [x] Metadatos de anulación agregados al esquema.
  - [x] RPC transaccional de estados terminales aplicada en RAES.
  - [x] Endpoints de revocación y anulación implementados.
  - [x] Revocación real validada.
  - [x] Anulación real validada.
- [x] Pruebas de integración.
  - [x] Sincronización base Institución A -> RAES validada.
  - [x] Registro idempotente de credencial vía conector validado.

## Etapa 2.7 — Administración y consumidores RAES
- [x] Modelo separado de clientes de API creado.
- [x] Scope `persons:resolve` agregado.
- [x] Autenticación de clientes no institucionales implementada.
- [x] Endpoint de resolución de persona implementado.
- [x] Consulta de credenciales por persona implementada sin persistencia en Credenly.
- [x] Autenticación de administradores RAES implementada.
- [x] API para registrar instituciones desde futura RAES Web implementada.
- [x] API para generar integraciones institucionales desde futura RAES Web implementada.
- [x] API para aprovisionar clientes como Credenly implementada.
- [x] Validación local y real completada.
  - [x] Login administrativo real validado.
  - [x] Cliente Credenly aprovisionado con `persons:resolve` y `credentials:read`.
  - [x] Resolución de persona y consulta de credenciales verificadas contra RAES.

## Etapa 3 — Backend Credenly
- [x] Supabase Auth.
  - [x] Servicio backend Credenly creado.
  - [x] Validación server-side de access tokens implementada.
  - [x] Endpoint `/auth/me` implementado.
  - [x] Health/readiness y protección 401 validados localmente.
  - [x] Flujo real de login con Supabase Auth validado.
- [x] Perfil ciudadano.
  - [x] `/auth/me` validado con sesión real.
  - [x] Creación y actualización de perfil validada.
  - [x] Consulta de perfil validada.
  - [x] Estado inicial `PENDIENTE_VERIFICACION` validado.
- [x] OCR.
  - [x] OCR local con `TESSERACT_LOCAL` validado con imagen sintética.
  - [x] Extracción de identidad y aprobación documental validadas.
  - [x] Flujo OCR -> vinculación RAES validado.
- [x] Vinculación RAES.
  - [x] Esquema `vinculaciones_raes` verificado.
  - [x] Base de autenticación Credenly -> RAES implementada en RAES.
  - [x] Credencial de servicio de Credenly aprovisionada y validada.
  - [x] Endpoint RAES de resolución implementado.
  - [x] Integración desde Credenly validada de extremo a extremo.
  - [x] Vinculación confirmada únicamente desde verificación de identidad `APROBADA`.
  - [x] Perfil ciudadano activado al confirmar la vinculación.
- [x] Consulta de credenciales solo vía RAES API.
  - [x] Regla de no persistir credenciales confirmada en el esquema.
  - [x] Endpoint RAES para consulta por persona implementado.
  - [x] Consumo autenticado desde cliente Credenly validado contra RAES.
  - [x] Endpoint ciudadano `GET /api/v1/credentials` implementado sin persistencia académica.
  - [x] Readiness de Credenly incluye conectividad con RAES.
  - [x] Readiness validado con base, Auth y RAES en estado `up`.
  - [x] Consulta ciudadana validada con credenciales `ANULADA` y `REVOCADA`.
  - [x] Respuesta validada con `source: "RAES"` y `persistedByCredenly: false`.
- [x] Comparticiones y verificación pública.
  - [x] Tokens aleatorios y hash SHA-256 implementados.
  - [x] Creación, listado y revocación de comparticiones implementados.
  - [x] Verificación pública consulta la credencial en vivo desde RAES.
  - [x] Campos visibles opcionales con lista permitida implementados.
  - [x] Registro de accesos con IP pseudonimizada implementado.
  - [x] Credenly mantiene solo `raes_credencial_id`, sin snapshot académico.
  - [x] Typecheck sin errores y 15/15 tests aprobados.
  - [x] Compartición real validada con credencial RAES revocada.
  - [x] Acceso público validado con `source: "RAES"` y `persistedByCredenly: false`.
  - [x] Revocación validada con respuesta pública posterior `410 SHARE_REVOKED`.
  - [x] Auditoría de accesos validada con resultados `OK` y `ENLACE_REVOCADO` e IP pseudonimizada.

## Etapa 4 — Institución B
- [x] Conector UdeA.
- [x] Pruebas multiinstitución.

## Finalización backend — Fase 1: auditoría de clientes API (2026-10-18)

- [x] Repositorio verificado: `main` limpio en `024420e`, actualizado sin cambios;
  trabajo en `feat/backend-completion`, sin merge a `main`.
- [x] Esquema real de `auditoria`, constraint, RLS y uso administrativo inspeccionados.
- [x] Migración nueva `20261018163434_api_client_audit.sql` aplicada en RAES y
  registrada en `supabase_migrations.schema_migrations`; históricos preservados.
- [x] `CLIENTE_API` admitido conservando `ADMIN`, `INTEGRACION`, `SISTEMA`.
- [x] Consultas de resolución y credenciales auditadas con cliente, operación,
  recurso, resultado, endpoint fijo y fecha; sin PII adicional ni secretos.
- [x] Scope insuficiente auditado con actor autenticado; entradas inválidas 400;
  errores internos sanitizados; fallo de auditoría devuelve 503 sin datos.
- [x] 22 pruebas nuevas de rutas/auth/lectura/auditoría con transporte PostgREST
  simulado; 62/62 pruebas del monorepo pasan (RAES 34, Credenly 15,
  contratos 8, conector Politécnico 5).
- [x] `pnpm typecheck`, `pnpm test`, `pnpm -r --if-present build` pasan.
  `pnpm lint` termina bien pero no ejecuta linters: faltan scripts por paquete.
- [x] Integración real: autenticación 200, resolución 200, consulta 200,
  UUID inválido 400, JSON inválido 400, sin autorización 401; cuatro registros
  de auditoría verificados sin modificar datos académicos.
- [x] Prueba SQL transaccional de actores y RLS ejecutada contra RAES;
  `anon` y `authenticated` no pueden leer ni insertar auditoría.

Hallazgos previos y siguientes pasos:

- El plugin Supabase conectado muestra otra cuenta. La CLI existente accede a
  RAES/Credenly; las instituciones están en una cuenta distinta. Se requiere
  autenticar un perfil separado `instituciones` antes de inspeccionar UdeA.
- CLI 2.121.0 falló en la comprobación de conexión con rol temporal. Se verificó
  el esquema y se aplicó la migración mediante Management API usando CLI
  2.81.3, vinculado en una carpeta temporal fuera del repositorio. DDL e historial
  de esta migración se registraron en una misma transacción SQL.
- Security Advisor detecta exposición previa de las RPC `SECURITY DEFINER`
  `aprovisionar_cliente_api` y `aprovisionar_integracion_institucional` a `anon`
  y `authenticated`. Corregido en la migración separada
  `20261018164429_restrict_provisioning_rpc.sql`: se revocan permisos directos
  y heredados de `PUBLIC`, se conserva `service_role` y se fija `search_path` vacío.
  Prueba SQL real `PROVISIONING_PERMISSIONS_OK`, ambas RPC alcanzables vía REST
  desde el servidor con entradas que activan sus guardas sin crear filas.
  Security Advisor posterior ya no reporta estas cuatro advertencias.
- Protección de contraseñas filtradas deshabilitada en Supabase Auth. Pendiente
  evaluar opciones gratuitas antes de producción; no se habilitan servicios pagos.
- Al cerrar Fase 1 quedaban Fases 2–5. Las secciones siguientes registran su avance;
  cada validación acota su alcance y no equivale a certificación de producción.

Preparación de Fase 2:

- Conector Politécnico, transformaciones, contratos, idempotencia y sincronización
  inspeccionados. `connector-udea` solo contiene un README; aún no hay implementación.
- Organización institucional confirmada desde la sesión web del usuario:
  `sesolqvprebaoswferuw`; Institución A `fswppckzhvpcbybslnop`,
  Institución B `taoapbewllieuephaxsy`. Universidad de Antioquia estaba pausada;
  reanudación solicitada sobre el proyecto existente del plan gratuito.
- Ambos proyectos reanudados y acceso CLI institucional verificado. El perfil
  usa un archivo TOML local (`--profile /Users/sargdev02/.supabase/instituciones.toml`),
  no un nombre libre; la sesión de Chrome no autentica la CLI.
- PR de revisión en borrador: https://github.com/SargDev02/credenciales-academicas/pull/14.
  No se ha fusionado a `main` ni desarrollado interfaces.

## Finalización backend — Fase 2: conector UdeA (2026-10-18)

- [x] Columnas, constraints, FKs, estados y RLS reales de B inspeccionados.
- [x] Motor compartido `packages/connector-core`; conectores Poli/UdeA separados,
  mismas rutas y contratos; namespaces históricos Poli preservados.
- [x] Lectura paginada y prevalidación de referencias, incluida matrícula-persona.
- [x] Consulta institucional del estado vigente con `credentials:read`, filtrada
  por la institución autenticada. Sin acceso directo del conector a RAES DB.
- [x] Correcciones detectadas contra contenido vigente, incluida vuelta al inicial;
  terminales conservados y conflictos reportados sin reactivación automática.
- [x] Aprovisionamiento real mediante herramienta genérica de operador server-side;
  auditoría `SISTEMA`, secretos hasheados en RAES y originales solo en `.env.local`.
- [x] 77/77 pruebas: RAES 38, motor 11, Poli 5, Credenly 15, contratos 8;
  typecheck monorepo y build RAES correctos.
- [x] Sincronización real UdeA: 13 sedes, 13 programas, 35 relaciones,
  17 fuentes/personas y 17 credenciales; una revocación y una anulación.
- [x] Reejecución de credenciales UdeA sin duplicados: permanecen 17 credenciales,
  19 versiones y 19 eventos, sin correcciones ni nuevas transiciones.
- [x] Politécnico probado con el motor compartido: 12 personas, 12 credenciales
  fuente presentes. `SIM-POLI-2025-0001`, creada por otra operación, se reporta
  sin adopción; se conserva además una credencial histórica ajena al conjunto fuente.

No hubo migraciones de esquema para B ni escrituras en bases institucionales.
La lectura institucional añade un permiso del catálogo existente, acotado por tenant.
Pendiente para Fase 3: las fuentes contienen 12 identidades exclusivas de A y 17 de B,
sin intersección; los escenarios compartidos requieren un conjunto de validación
apropiado. No se alteraron documentos fuente para simular coincidencias.

## Finalización backend — Fase 3: validación multiinstitución (2026-10-18)

- [x] A/B reales: cada identidad fuente resuelve a una única persona maestra;
  fuente institucional y credencial asociadas a la persona correcta.
- [x] Aislamiento real: la otra institución recibe 404 para códigos ajenos.
- [x] E: reejecución de credenciales UdeA conserva 17 credenciales, 19 versiones
  y 19 eventos. Poli conserva sus fuentes al repetir sincronización base.
  Repetición posterior de base UdeA y credenciales Poli también completada sin
  nuevas versiones ni transiciones; RAES conserva 29 personas y 29 fuentes únicas.
- [x] F/G: RPC reales de corrección, revocación y anulación sobre una credencial
  UdeA existente; versiones y eventos comprobados y cambios revertidos por
  subtransacciones. No se crean credenciales de prueba persistentes.
- [x] H: lectura del servicio Credenly -> RAES con vínculo existente y consulta
  HTTP ciudadana real con el fixture compartido: dos instituciones, `source: RAES`,
  `persistedByCredenly: false` y cero escrituras académicas. La cuenta temporal se
  eliminó; ver evidencia independiente de limpieza en el cierre de este bloque.
- [x] C/D en RAES: fixture compartido autorizado posteriormente; una persona
  maestra, dos fuentes y dos credenciales institucionales con procedencia correcta.
  El cliente real Credenly y su ruta HTTP ciudadana autenticada las recuperan.
  Ver evidencia de la ejecución y limpieza más abajo.

Verificador reproducible: `services/raes-api/scripts/verify-multi-institution.ts`.
Resultado real: A 12 personas/12 credenciales fuente; B 17/17; lecturas cruzadas 404;
servicio Credenly correcto, sin mutaciones académicas. Aquella validación inicial
tenía 78 pruebas y detectó la discrepancia histórica Poli; posteriormente se
resolvió preservando la legacy y se completó C/D con el fixture aprobado.
La Fase 3 queda cerrada para el prototipo con la lectura HTTP real descrita abajo.

## Finalización backend — Fase 4: hardening (2026-10-18)

- [x] Auth institucional, cliente API, admin y ciudadano: ausencia/formato inválido,
  expiración, revocación, inactividad, scopes y roles insuficientes cubiertos por
  pruebas controladas; `user_metadata` no permite elevar roles administrativos.
- [x] Integraciones de instituciones suspendidas/inactivas rechazadas aunque la
  integración siga activa. Secretos revocados comprobados también en la aplicación.
- [x] JSON inválido y validaciones con respuestas 400; bytes reales limitados a
  64 KiB y exceso 413, incluido `Content-Length` falso o ausente.
- [x] Multipart acotado antes de parsearlo (8 MiB + 64 KiB de envoltura), archivo
  limitado a 8 MiB; formatos inválidos 400 y MIME no permitido rechazado.
- [x] Errores y logs sanitizados, sin cuerpos, tokens ni mensajes SQL internos;
  respuestas conservan `error`/`message` y los códigos HTTP de dominio.
- [x] RPC Credenly de vinculación limitada a servidor con `search_path` vacío.
  Migración `20261018171510_restrict_raes_link_rpc.sql` aplicada y registrada.
- [x] Estado/fechas de perfil protegidos contra cambios directos del ciudadano;
  nombres/apellidos siguen editables bajo RLS. Migración
  `20261018172010_restrict_profile_write_columns.sql` aplicada y registrada.
- [x] Auditoría pública obligatoria antes de entregar datos: fallo de persistencia
  devuelve 503, enlaces revocados/expirados devuelven 410 con acceso registrado.
- [x] Pruebas SQL reales de permisos y propiedad sin mutaciones persistentes.
  Cero tablas públicas sin RLS y cero constraints sin validar en RAES.
- [x] Lectura ciudadana paginada y consulta de versiones vigentes por lotes,
  sin truncamiento silencioso a 1000 filas; falta de versión vigente produce error
  íntegro en vez de una respuesta parcial. Dos regresiones nuevas pasan.
- [x] Credenly sin tabla académica; hashes de compartición/IP válidos; cero `.env`
  privados en archivos versionados. No se agregan servicios pagos.

## Finalización backend — Fase 5: revisión técnica y cierre de este bloque

| Comprobación | Resultado |
| --- | --- |
| `pnpm typecheck` | Pasa en todos los paquetes aplicables |
| `pnpm test` | 117/117: RAES 59, Credenly 29, motor 16, contratos 8, Poli 5 |
| `pnpm lint` | Termina bien; ningún paquete declara linter, limitación previa |
| `pnpm -r --if-present build` | Contratos y ambos backends compilan |
| Readiness HTTP real | RAES 200; Credenly 200 con base y RAES disponibles |
| Auditoría de clientes real | Auth/lecturas 200; UUID/JSON 400; sin Auth 401; eventos verificados |
| Integración multiinstitución real | 30 personas/31 fuentes; una identidad compartida; sin duplicados; aislamiento 404 |
| Ruta ciudadana C/D HTTP real | 200 con ambas instituciones; source RAES; persistedByCredenly false |
| Limpieza ciudadana temporal | Auth/sesión/perfil/verificación/vinculación: 0 filas; HTTP posterior 401 |
| Ciclo de vida real SQL | Corrección, revocación, anulación e historial pasan con rollback |
| Compartición pública real | 200, revocación y posterior 410; auditoría y hash comprobados |
| Security Advisor RAES/Credenly | Solo permanece protección de contraseñas filtradas deshabilitada |

Las pruebas de autorización negativa usan transporte controlado; no se desactivan
usuarios ni secretos reales para simular fallos. El script de compartición usa el
servicio interno con un ciudadano de prueba existente y valida la ruta pública HTTP;
no representa un nuevo login ciudadano real. Se preservó el esquema de cuatro
sistemas y no se desarrolló ninguna UI. Las cuatro migraciones nuevas de este bloque
están registradas en sus respectivas bases; los históricos no se editaron.

### Pendientes y decisiones antes de producción

1. **Prueba de identidad**: Tesseract extrae texto y la confianza OCR actual permite
   aprobación documental; no prueba autenticidad del documento ni titularidad.
   El piloto usa datos sintéticos; el mecanismo de verificación para personas
   reales necesita una decisión antes de exponerlo en producción.
2. **Recuperación/reproducibilidad**: el repositorio contiene ampliaciones y RPC,
   pero no todo el DDL inicial de los cuatro proyectos. Antes de una instalación
   nueva deben versionarse/validarse baselines sin datos personales ni secretos y
   probar restauración. No se inventó un esquema inicial durante esta revisión.
3. **Operación**: definir política gratuita de límites de acceso, retención de OCR
   y auditoría, rotación de secretos y orden de sincronizaciones concurrentes.
   Ajustar tamaño de uploads y tiempos de OCR al despliegue real; solo se probaron
   estos límites localmente. No se habilitaron servicios o planes pagos.
4. **Protección de contraseñas filtradas**: deshabilitada en ambos proyectos;
   evaluar opciones permitidas sin activar cargos. Las migraciones cierran los
   permisos de RPC observados.
5. **Herramientas de calidad**: falta linter por paquete.

Los pendientes anteriores corresponden a producción y no se marcan como resueltos.
El backend está funcionalmente cerrado para el prototipo; no está listo para
producción. No se habilitan interfaces ni se fusiona el PR como parte de este cierre.

## Resolución explícita de C/D y ownership legacy — PR #14 (2026-10-18)

### Datos añadidos y validación real

- [x] Se agregaron exactamente **3 filas por fuente**: un estudiante, una matrícula
  y una credencial; documento compartido `CC / SYNTH-CD-20261018-001`, sin PII real.
  IDs, códigos, campos y relaciones completos en
  `supabase/fixtures/multi-institution/README.md`; SQL transaccional por institución.
- [x] El documento no existía previamente en A, B ni RAES. Las huellas de las siete
  tablas originales de cada fuente son idénticas antes/después, excluyendo solo
  los nuevos UUID del fixture. No se alteraron personas, matrículas ni credenciales
  existentes, ni se agregaron sedes/programas.
- [x] Ambos conectores completos crearon una credencial cada uno y resolvieron
  una sola persona maestra: `daf57960-31cb-432b-8e45-684c63651f85`.
  Tiene exactamente **2 fuentes**, con UUID institucionales diferentes.
- [x] Credencial A `SYNTH-POLI-CD-20261018-001`: RAES
  `981200b3-a30c-4088-ae09-84b27beab01b`, institución
  `63829b97-c4d7-4467-a56a-f98c0c1f2c3a`.
- [x] Credencial B `SYNTH-UDEA-CD-20261018-001`: RAES
  `b80fb8d4-6a6c-4453-948a-62018be8b7b6`, institución
  `6d6a4b44-db0b-40a3-9863-0fc12f9f0d8b`.
- [x] RAES HTTP y el cliente real Credenly recuperan ambas para la misma persona,
  preservando institución y procedencia. Ambas están VIGENTE, versión 1, con un
  evento REGISTRADA. No se insertó la persona ni sus credenciales directamente en
  RAES ni se escribió información académica en Credenly.
- [x] Segunda sincronización completa de A y B: **0 altas, 0 correcciones, 0
  revocaciones y 0 anulaciones**; A reporta 12 sin cambios + una legacy preservada;
  B reporta 18 sin cambios. Huellas antes/después `IDENTICAL`: 30 personas maestras,
  31 fuentes, 32 credenciales, 39 operaciones, 39 versiones y 39 eventos.
  La auditoría de consultas puede crecer; no se confunde con eventos académicos.
- [x] Consulta HTTP ciudadana compartida autorizada explícitamente y ejecutada:
  `GET /api/v1/credentials` en Credenly compilado local (3102), con sesión real
  Supabase Auth, devuelve **HTTP 200** con ambas credenciales e instituciones,
  `source: "RAES"` y `persistedByCredenly: false`.
  `services/credenly-api/scripts/verify-shared-person.ts` comprueba los UUID del
  fixture; los códigos de origen se trazan por esos mismos UUID en el verificador
  RAES, sin agregar campos ni excepciones a la aplicación.
- [x] Se creó únicamente un usuario sintético temporal, su perfil, verificación
  `MOCK_DESARROLLO` y vinculación. La resolución y vinculación usaron los servicios
  normales y la RPC existentes; el login fue real. La verificación fue un fixture
  sintético aprobado, **no OCR ni comprobación de autenticidad reales**.
  Contraseña aleatoria solo en memoria; no se imprimieron sesión, contraseña,
  claves ni secretos y no se enviaron correos.
- [x] Usuario temporal `cd1e6510-f50e-4e03-950c-d01a57d530e8`; verificación temporal
  `b1c3bc36-b311-4dcb-af02-58ac28e6f67d`: eliminados. Se revocó la sesión y se borró
  en orden vinculación, verificación, perfil y usuario Auth. No hubo errores de
  limpieza ni FK; el script se detiene al primer fallo, sin forzar cascadas.
- [x] Comprobación independiente SQL posterior: **0 usuarios Auth, 0 sesiones,
  0 perfiles, 0 verificaciones y 0 vinculaciones** del usuario temporal; tampoco
  queda vinculación a la persona sintética compartida. Consulta administrativa de
  Auth devuelve 404 y la sesión usada devuelve HTTP 401 al consultar Credenly.
- [x] Las huellas de **las cinco tablas públicas de Credenly** son idénticas antes
  y después de la prueba y limpieza: sin cambios a cuentas existentes ni escrituras
  académicas. Solo existen perfiles, verificaciones, vinculaciones, comparticiones
  y accesos; no hay tablas académicas.
- [x] Huellas completas de las siete tablas de A y B, incluidos los fixtures,
  idénticas antes/después. Verificador RAES posterior devuelve `IDENTICAL` contra
  la referencia del replay: persona maestra, dos fuentes y dos credenciales C/D,
  así como todo el historial RAES, preservados. La legacy sigue REVOCADA v3.

### Decisión definitiva sobre SIM-POLI-2025-0001

No es un fallo de ownership del conector. El registro RAES
`2921c117-d4ac-4132-9e4d-2c4d87f8c5fc` se creó el **2026-10-05 18:58:52 UTC** con
operación `343be5a4-d101-4eb8-90a0-0200103aca31` y clave
`credencial-SIM-POLI-2025-0001`. El conector espera
`poli:create:7cf56163-1f19-4dce-b096-30f8e02b7b49`. La integración es la misma,
pero la operación de alta no pertenece al esquema de claves del conector.
El primer commit de implementación del conector, `ab31cd6`, es del
2026-10-05 23:45:32 UTC, posterior al alta y a sus cambios históricos.

Los eventos originales son REGISTRADA (18:58:52 UTC), CORREGIDA (23:35:20 UTC) y
REVOCADA (23:36:16 UTC), todos del 5 de octubre. Continúa **REVOCADA, versión 3**,
con `updated_at = 2026-10-05T23:36:16.708994Z`, aunque la fuente aún dice VIGENTE.
Adoptarla para reconciliar podría corregir un estado terminal o sobrescribir la
intención del historial. Se preserva deliberadamente, como autorizó el usuario.

Se conserva `existingCredentialsNotAdopted`; no se hizo migración, cambio de datos
ni excepción por código. La prueba genérica cubre claves ajenas o ausentes, estados
VIGENTE/REVOCADA/ANULADA, contenido y estado divergentes y dos reejecuciones:
ninguna adopción, creación, corrección o transición; filas, historial y eventos intactos.

### Revalidación de este bloque

- `pnpm typecheck`, `pnpm test` (**117/117**), builds aplicables y `pnpm lint` pasan.
  Lint sigue sin scripts por paquete; no se presenta como análisis estático real.
- Después de la prueba HTTP y limpieza se repitieron `pnpm typecheck`, los
  **117 tests**, `pnpm lint` y `pnpm -r --if-present build`: todos terminan bien.
  Contratos y ambos backends compilan. Lint conserva su limitación de scripts.
  El verificador ciudadano se comprobó además con TypeScript estricto y ejecución real.
- Cinco pruebas SQL reales pasan con rollback: auditoría, aprovisionamiento,
  ciclo de vida, vinculación y permisos de perfiles.
- Auditoría HTTP real pasa; compartición pública 200 -> revocación -> 410 pasa y
  el enlace de prueba queda revocado. Readiness de ambos servicios devuelve 200.
- Cero duplicados de identidad, fuente o credencial; cero constraints sin validar
  y cero tablas públicas sin RLS en RAES. Credenly conserva solo sus cinco tablas
  operativas y hashes válidos; no almacena estado académico.
- Solo `.env.example` versionados; cero `.env` privados, traineddata, JWT, claves
  privadas o claves Supabase secretas detectados. Ningún secreto se imprime.
- C/D y pruebas multiinstitución completados; conector UdeA validado.
  PR #14 **Ready for Review**, sin merge a `main`.

## Etapa 5 — Interfaces y despliegue
- [ ] RAES Web completa.
  - [x] Foundation, login SSR y primera consulta administrativa.
  - [ ] Altas y aprovisionamiento según rol (gap API documentado).
- [ ] Credenly Web integrada.
  - [x] Foundation y galería visual; sin flujo ciudadano aún.
- [ ] Despliegues independientes.

## Frontend — Fases A/B/C (2026-10-18)

- [x] Working tree limpio; `main` actualizado por fast-forward al squash
  `50c28c2457276e79043eb21bf8a0484c458a966c`. No se volvió a fusionar PR #14
  ni su rama. Nueva rama `feat/frontend-platform`.
- [x] Inspección de monorepo, APIs, contratos, variables y siete componentes Figma
  mediante MCP, con código/contexto y screenshots de referencia.
- [x] Dos apps Next.js independientes, `packages/ui` y `packages/web-core`.
- [x] Tokens, Inter local, Button Primary/Secondary, Input, Badge, CredentialCard,
  Card, Alert, Spinner, Skeleton, EmptyState, FormField y PageHeading.
- [x] Galería de demostración en ambas apps; sin datos académicos simulados en
  pantallas integradas. Variantes compactas y ajustes AA documentados.
- [x] Foundation: typecheck, 132 pruebas y builds de ambas apps/backends pasan;
  los 117 tests anteriores siguen pasando. No hay linter por paquete.
- [x] RAES Web inicial: login, sesión y lectura administrativa implementados; ver Fase D.
- [ ] Rol del administrador: la API aún no devuelve perfil/rol autenticado. Se
  requiere decisión antes de habilitar altas según rol. No se consulta la tabla
  privada ni se confía en metadata del usuario.
- [ ] Credenly funcional: pendiente del reporte/decisión tras la primera RAES Web.

## Frontend — Fase D: primera RAES Web (2026-10-18)

- [x] Login/logout SSR con JWT solo en servidor y cookies HttpOnly aisladas.
  Sin service role en las webs, sin tokens en localStorage/sessionStorage.
- [x] Layout administrativo, navegación activa y skip link; resumen con métricas
  derivadas únicamente de listados reales, instituciones, filtros/detalle y clientes API.
- [x] Loading, empty, error, estados y vista de auditoría que explica el gap.
  No se simula actividad ni se inventan scopes/listados.
- [x] Se mantienen UI y permisos en lectura para cualquier rol válido hasta poder
  confirmar el rol real vía API. Ni metadata ni tablas privadas se consultan para inferirlo.
- [x] Chrome real: cuenta sintética rechazada sin perfil y aceptada como AUDITOR,
  dos instituciones leídas desde RAES API, detalle/filtros/clientes/logout y guard.
  Cookies HttpOnly/Lax, cero storage de sesión y cero peticiones browser a bases
  de datos; sin errores de hidratación. Perfil/cuenta de QA eliminados.
- [x] Responsive real del resumen y las tablas en 360/768/1024/1440; las tablas
  cambian a fichas en móvil, conservando labels/acciones. Correo largo truncado
  visualmente con nombre completo accesible. Ver capturas de QA locales.
- [ ] Auditoría consultable, integraciones listables y scopes asignados: no existen
  endpoints GET suficientes; se documenta y no se modifica backend.
- [ ] Altas institucionales y clientes/integraciones: necesitan la consulta del
  perfil/rol administrativo. Propuesta mínima `GET /api/v1/admin/me` en
  `docs/frontend.md`, pendiente de aprobación antes de modificar backend.
- [ ] Continuar Credenly y comparticiones después del reporte de este bloque,
  según la secuencia acordada. Sin despliegue ni merge.

### Resultado y punto de revisión frontend

- [x] Verificación final: `pnpm typecheck`, **138/138 tests**, `pnpm lint` y
  `pnpm -r --if-present build` terminan correctamente. Lint conserva el límite
  conocido: ningún paquete tiene script de análisis. Los 117 tests previos pasan.
- [x] Chrome: **12/12** tests públicos de componentes, teclado y responsive;
  prueba Auth/RAES real adicional pasa para el código compilado final.
- [x] QA `7f98bf61-89b4-45d0-ae35-3c3b39fee33d`: SQL independiente confirma cero
  Auth users, sesiones y perfiles; cero cuentas del prefijo sintético de todos
  los intentos. Ninguna institución/cliente/integración ni dato académico alterado.
- [x] Cero env privados, JWT/claves privadas o traineddata versionables detectados;
  cero secretos de backend en los bundles JS de las dos webs.
- [x] Revisión visual: referencia Figma y capturas reales a los cuatro anchos.
- [x] PR #15 abierto **Draft**, base `main`, rama `feat/frontend-platform`.
- [ ] Aprobar o rechazar la propuesta mínima `GET /api/v1/admin/me` antes de
  habilitar altas por rol y continuar el siguiente bloque, según la instrucción
  de reportar una limitación material al completar Foundation + primera RAES Web.

Commits de implementación: `41afe24` Foundation y `ccb5153` RAES Web/QA.
No se modifica el backend ni se inicia Credenly integrado mientras se resuelve
ese punto. El prototipo backend sigue cerrado funcionalmente, sin declaración
de preparación para producción.
