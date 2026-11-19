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
introduce almacenamiento académico en Credenly. En RAES se añadió la introspección
administrativa `/admin/me` autorizada, sin cambiar sus roles por defecto. El alcance
Credenly Admin posterior añade modelo propio y lecturas operativas aprobadas; sin RPC nueva.

Credenly Web usa exclusivamente Credenly API para perfil/verificación/vinculación,
lectura académica y comparticiones. La consulta pública permanece dinámica y llega
a RAES por Credenly API. Las webs comparten presentación/transporte, conservando
sesiones Auth y despliegues independientes; no se comparten claves de integraciones.

## Administración propia de Credenly

Credenly Admin vive en `/admin/*` dentro de Credenly Web, con layout y cookies
independientes del ciudadano. El backend valida Auth UUID + `perfiles_admin`
ACTIVO/ADMIN_CREDENLY y audita sus consultas mínimas. No autoriza por correo o
metadata, no gestiona instituciones RAES ni obtiene acceso académico como ciudadano.
Panel solo de lectura: cuentas mínimas, estados agregados, readiness e incidentes
de auditoría. No accede a RAES DB ni presenta documentos/credenciales completas.

La separación ciudadana ya se validó: Valentina conserva su
UUID y relaciones, con email actualizado a `valentina@yopmail.com`, buzón y login
validados. El administrador sintético `admin@credenly.com` se aprovisionó después,
con UUID propio y cero relaciones ciudadanas. Ver [autenticación](authentication.md),
[frontend](frontend.md) e [informe de aprovisionamiento](reports/2026-10-19-credenly-admin-provisioning.md).

## Hardening pre-deploy

Se conserva la separación de los cuatro proyectos. Controles HTTP comunes en
web-core no contienen lógica académica ni acceso a DB; las APIs siguen siendo la
autoridad de permisos. Las webs usan CSP con nonce, cookies HttpOnly separadas y
respuestas privadas sin caché; los assets mantienen caché. La separación de
perfiles Credenly también se verifica por triggers PostgreSQL aprobados, sin email
como autoridad. Los límites locales de solicitudes/OCR no son un rate limiter
distribuido. PGlite solo existe como herramienta de desarrollo para reconstrucción
DDL; nunca sustituye Supabase ni participa en el runtime del producto.
