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
- [ ] Autenticación institucional y scopes.
  - [x] Formato Bearer y hashing implementados.
  - [x] Validación de scopes implementada.
  - [x] Bootstrap de Institución A implementado.
  - [ ] Bootstrap probado contra RAES.
  - [ ] Endpoint autenticado `/auth/whoami` validado.
- [ ] Idempotencia.
- [ ] Conector Politécnico.
- [ ] Sedes y programas.
- [ ] Resolución de personas.
- [ ] Registro/versionado de credenciales.
- [ ] Correcciones.
- [ ] Revocaciones/anulaciones.
- [ ] Pruebas de integración.

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
