# Arquitectura

## Vista general

```text
Institución A DB -> connector-poli -> RAES API <- connector-udea <- Institución B DB
                                      |
                                      v
                                   RAES DB

Credenly API -> RAES API (consulta académica)
Credenly API -> Credenly DB + Supabase Auth (datos ciudadanos)
```

Las bases institucionales representan sistemas académicos naturales y no conocen RAES.

RAES administra instituciones e integraciones, pero la información académica de sedes, programas, personas y credenciales llega desde las instituciones.

Credenly contiene autenticación, perfil, verificación OCR, vinculación con RAES y comparticiones.

**Credenly no tiene tabla de credenciales.**

El perfil académico, el detalle de una credencial y la verificación pública consultan RAES para obtener el estado actual.

## Interfaces del prototipo

RAES Web y Credenly Web son aplicaciones App Router independientes en `apps/`.
La integración se hace en el servidor web usando el JWT del usuario y la API de
cada producto; el browser no recibe service role. Una clave de cliente/integración recién creada
solo se muestra una vez al administrador autorizado, sin persistencia web.
Supabase Auth se mantiene separado por producto.

`packages/ui` contiene solo presentación; `packages/web-core` contiene transporte
HTTP y validación de configuración, sin consultas a tablas de negocio. No se
introduce almacenamiento académico en Credenly. El único cambio backend de esta
etapa es la introspección administrativa `/admin/me`, aprobada explícitamente;
no cambia permisos, esquema ni RPC.

Credenly Web usa exclusivamente Credenly API para perfil/verificación/vinculación,
lectura académica y comparticiones. La consulta pública permanece dinámica y llega
a RAES por Credenly API. Las webs comparten presentación/transporte, conservando
sesiones Auth y despliegues independientes; no se comparten claves de integraciones.

## Propuesta pendiente: administración propia de Credenly

El [informe de separación de cuentas y administración](reports/2026-10-18-credenly-administration.md)
documenta el diagnóstico y el estado objetivo: administrador Credenly independiente
de la identidad ciudadana de Valentina. El perfil/rol y panel de administración de
Credenly no están implementados; sus cambios de esquema, autorización y API requieren
aprobación específica. RAES no sustituye la administración operativa de Credenly.
