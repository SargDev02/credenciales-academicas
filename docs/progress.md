# Progreso

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
- Fases 2–5 pendientes: UdeA, integración multiinstitución, hardening integral
  y revisión final. Esta validación no equivale a certificación de todo el backend.

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

## Etapa 5 — Interfaces y despliegue
- [ ] RAES Web.
- [ ] Credenly Web.
- [ ] Despliegues independientes.
