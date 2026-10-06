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

## Etapa 3 — Backend Credenly
- [ ] Supabase Auth.
- [ ] OCR.
- [ ] Vinculación RAES.
- [ ] Consulta de credenciales solo vía RAES API.
- [ ] Comparticiones y verificación pública.

## Etapa 4 — Institución B
- [ ] Conector UdeA.
- [ ] Pruebas multiinstitución.

## Etapa 5 — Interfaces y despliegue
- [ ] RAES Web.
- [ ] Credenly Web.
- [ ] Despliegues independientes.
