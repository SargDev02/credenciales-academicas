# Progreso

Estado al 2026-10-18: auditoría de clientes y ambos conectores implementados y
validados; hardening aplicado y revisión técnica realizada. El cierre integral del
backend permanece pendiente de los casos C/D reales y de resolver la credencial
histórica no adoptada. No se han iniciado interfaces ni despliegues frontend.

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
- [ ] RAES API.
  - [x] Servicio base y health checks.
  - [x] Cliente Supabase server-side.
  - [x] Conexión local con RAES verificada.
- [x] Autenticación institucional y scopes.
  - [x] Formato Bearer y hashing implementados.
  - [x] Validación de scopes implementada.
  - [x] Bootstrap de Institución A implementado.
  - [x] Bootstrap probado contra RAES.
  - [x] Endpoint autenticado `/auth/whoami` validado.
- [ ] Idempotencia.
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
- [ ] Sedes y programas.
  - [x] Endpoints autenticados implementados.
  - [x] Sincronización real validada con Institución A.
- [ ] Resolución de personas.
  - [x] Resolución maestra por tipo + número de documento implementada.
  - [x] Fuente institucional por identificador de origen implementada.
  - [x] Resolución real validada con Institución A.
- [ ] Registro/versionado de credenciales.
  - [x] RPC transaccional de registro inicial aplicada en RAES.
  - [x] Endpoint POST /api/v1/credentials implementado.
  - [x] Versión 1 + evento REGISTRADA implementados.
  - [x] Registro real validado con una credencial de Institución A.
- [ ] Correcciones.
  - [x] Versionado completo con tipo y categoría.
  - [x] RPC transaccional de corrección aplicada en RAES.
  - [x] Endpoint de corrección implementado.
  - [x] Corrección real validada de extremo a extremo.
- [ ] Revocaciones/anulaciones.
  - [x] Metadatos de anulación agregados al esquema.
  - [x] RPC transaccional de estados terminales aplicada en RAES.
  - [x] Endpoints de revocación y anulación implementados.
  - [x] Revocación real validada.
  - [x] Anulación real validada.
- [ ] Pruebas de integración.
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
- [ ] Pruebas multiinstitución.

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
- [x] H: integración de servicio Credenly -> RAES real con su vinculación ciudadana
  existente. Una prueba de ruta con transporte simulado verifica dos instituciones,
  `source: RAES`, `persistedByCredenly: false` y ausencia de escrituras académicas.
- [ ] C/D reales: ninguna identidad documental está presente en ambas fuentes.
  No se cambian documentos ni se añaden datos a las instituciones para forzarlo.
  Tampoco se presenta la prueba simulada de Credenly como integración real C/D.

Verificador reproducible: `services/raes-api/scripts/verify-multi-institution.ts`.
Resultado real: A 12 personas/12 credenciales fuente; B 17/17; lecturas cruzadas 404;
servicio Credenly correcto, sin mutaciones académicas. Se detecta una discrepancia
histórica de estado en la credencial Poli no adoptada; requiere decisión explícita
antes de reconciliar datos ajenos al conector. Total de pruebas locales: 78.
La Fase 3 permanece abierta por C/D y la revisión de esa credencial histórica.

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
| `pnpm test` | 112/112: RAES 59, Credenly 29, motor 11, contratos 8, Poli 5 |
| `pnpm lint` | Termina bien; ningún paquete declara linter, limitación previa |
| `pnpm -r --if-present build` | Contratos y ambos backends compilan |
| Readiness HTTP real | RAES 200; Credenly 200 con base y RAES disponibles |
| Auditoría de clientes real | Auth/lecturas 200; UUID/JSON 400; sin Auth 401; eventos verificados |
| Integración multiinstitución real | 29 personas/fuentes; sin duplicados; aislamiento 404 |
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

1. **Casos C/D reales**: las fuentes no comparten documentos. Falta un conjunto
   aprobado que cubra una persona maestra con dos fuentes y credenciales de ambas
   instituciones. No se alteraron datos fuente ni se inventaron coincidencias.
2. **Credencial histórica Poli**: `SIM-POLI-2025-0001` tiene estado RAES distinto
   de la fuente y un alta ajena al conector. Requiere revisión/decisión explícita;
   no se adopta ni cambia una credencial terminal automáticamente.
3. **Prueba de identidad**: Tesseract extrae texto y la confianza OCR actual permite
   aprobación documental; no prueba autenticidad del documento ni titularidad.
   El piloto usa datos sintéticos; el mecanismo de verificación para personas
   reales necesita una decisión antes de exponerlo en producción.
4. **Recuperación/reproducibilidad**: el repositorio contiene ampliaciones y RPC,
   pero no todo el DDL inicial de los cuatro proyectos. Antes de una instalación
   nueva deben versionarse/validarse baselines sin datos personales ni secretos y
   probar restauración. No se inventó un esquema inicial durante esta revisión.
5. **Operación**: definir política gratuita de límites de acceso, retención de OCR
   y auditoría, rotación de secretos y orden de sincronizaciones concurrentes.
   Ajustar tamaño de uploads y tiempos de OCR al despliegue real; solo se probaron
   estos límites localmente. No se habilitaron servicios o planes pagos.
6. **Herramientas de calidad**: falta linter por paquete. Protección de contraseñas
   filtradas deshabilitada en ambos proyectos; evaluar opciones permitidas sin
   activar cargos. Las migraciones cierran los permisos de RPC observados.

La revisión técnica está documentada; el backend no se declara cerrado ni listo
para producción mientras permanezcan estos criterios. Próximo paso: acordar los
casos compartidos y la resolución del registro histórico antes de iniciar interfaces.

## Etapa 5 — Interfaces y despliegue
- [ ] RAES Web.
- [ ] Credenly Web.
- [ ] Despliegues independientes.
