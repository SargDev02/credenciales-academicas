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
- [ ] Supabase Auth.
  - [x] Servicio backend Credenly creado.
  - [x] Validación server-side de access tokens implementada.
  - [x] Endpoint `/auth/me` implementado.
  - [x] Health/readiness y protección 401 validados localmente.
  - [x] Flujo real de login con Supabase Auth validado.
- [ ] Perfil ciudadano.
  - [x] `/auth/me` validado con sesión real.
  - [x] Creación y actualización de perfil validada.
  - [x] Consulta de perfil validada.
  - [x] Estado inicial `PENDIENTE_VERIFICACION` validado.
- [ ] OCR.
- [ ] Vinculación RAES.
  - [x] Esquema `vinculaciones_raes` verificado.
  - [x] Base de autenticación Credenly -> RAES implementada en RAES.
  - [x] Credencial de servicio de Credenly aprovisionada y validada.
  - [x] Endpoint RAES de resolución implementado.
  - [x] Integración desde Credenly validada de extremo a extremo.
  - [x] Vinculación confirmada únicamente desde verificación de identidad `APROBADA`.
  - [x] Perfil ciudadano activado al confirmar la vinculación.
- [ ] Consulta de credenciales solo vía RAES API.
  - [x] Regla de no persistir credenciales confirmada en el esquema.
  - [x] Endpoint RAES para consulta por persona implementado.
  - [x] Consumo autenticado desde cliente Credenly validado contra RAES.
  - [x] Endpoint ciudadano `GET /api/v1/credentials` implementado sin persistencia académica.
  - [x] Readiness de Credenly incluye conectividad con RAES.
  - [x] Readiness validado con base, Auth y RAES en estado `up`.
  - [x] Consulta ciudadana validada con credenciales `ANULADA` y `REVOCADA`.
  - [x] Respuesta validada con `source: "RAES"` y `persistedByCredenly: false`.
- [ ] Comparticiones y verificación pública.
  - [x] Tokens aleatorios y hash SHA-256 implementados.
  - [x] Creación, listado y revocación de comparticiones implementados.
  - [x] Verificación pública consulta la credencial en vivo desde RAES.
  - [x] Campos visibles opcionales con lista permitida implementados.
  - [x] Registro de accesos con IP pseudonimizada implementado.
  - [x] Credenly mantiene solo `raes_credencial_id`, sin snapshot académico.
  - [ ] Typecheck, tests y validación real pendientes.

## Etapa 4 — Institución B
- [ ] Conector UdeA.
- [ ] Pruebas multiinstitución.

## Etapa 5 — Interfaces y despliegue
- [ ] RAES Web.
- [ ] Credenly Web.
- [ ] Despliegues independientes.
