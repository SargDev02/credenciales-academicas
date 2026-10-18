# Bases de datos

Existen cuatro proyectos Supabase independientes.

## Institución A

Politécnico Colombiano Jaime Isaza Cadavid.

Tablas: `institucion`, `sedes`, `programas`, `programa_sede`, `estudiantes`, `matriculas`, `credenciales`.

## Institución B

Universidad de Antioquia. Mantiene su propia base físicamente aislada.

## RAES

Tablas: `instituciones`, `sedes`, `programas`, `programa_sede`, `personas_maestra`, `persona_fuentes`, `credenciales`, `credencial_versiones`, `credencial_eventos`, `integraciones_institucionales`, `integracion_secretos`, `scopes`, `integracion_scopes`, `operaciones_api`, `perfiles_admin`, `auditoria`.

La identidad de persona usa unicidad compuesta `(tipo_documento, numero_documento)`.

## Credenly

Tablas: `perfiles`, `verificaciones_identidad`, `vinculaciones_raes`, `comparticiones`, `accesos_compartidos`.

No existe una tabla de credenciales. `raes_persona_id` y `raes_credencial_id` son referencias externas, no foreign keys.

La confirmación de vinculaciones solo puede ejecutarse desde `service_role`; sus
permisos se revocan explícitamente a `PUBLIC`, `anon` y `authenticated`.
Los ciudadanos pueden insertar su perfil con nombres y apellidos y editar esos
dos campos bajo RLS; el estado de verificación y las fechas son controlados por
el servidor. Las migraciones de permisos no cambian entidades ni unicidad.
