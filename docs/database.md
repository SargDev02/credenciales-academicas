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

Tablas ciudadanas: `perfiles`, `verificaciones_identidad`, `vinculaciones_raes`, `comparticiones`, `accesos_compartidos`.
Administración separada: `perfiles_admin`, `auditoria_admin`.

No existe una tabla de credenciales. `raes_persona_id` y `raes_credencial_id` son referencias externas, no foreign keys.

La confirmación de vinculaciones solo puede ejecutarse desde `service_role`; sus
permisos se revocan explícitamente a `PUBLIC`, `anon` y `authenticated`.
Los ciudadanos pueden insertar su perfil con nombres y apellidos y editar esos
dos campos bajo RLS; el estado de verificación y las fechas son controlados por
el servidor. Las migraciones de permisos no cambian entidades ni unicidad.

### Identidad y auditoría administrativa Credenly

Migraciones autorizadas y aplicadas solo al proyecto Credenly:

- `20261019042521_credenly_admin_identity.sql`: `perfiles_admin`, PK UUID/FK a
  `auth.users`, nombres/apellidos, rol único `ADMIN_CREDENLY`, estado
  `ACTIVO|INACTIVO` (por defecto INACTIVO), timestamps. Reutiliza el trigger existente
  de updated_at. Sin nuevas funciones o RPC ni cuentas sembradas.
- `20261019042601_credenly_admin_audit.sql`: `auditoria_admin`, UUID, actor FK al
  perfil administrativo, acción, resultado, recurso/tipo/ID opcional y created_at.
  Índices para actor/fecha y errores recientes. No payload, email, IP, metadata,
  imágenes, texto OCR o información académica.

Ambas tienen RLS habilitado y ninguna policy browser. Se revocan todos los permisos
a PUBLIC/anon/authenticated; no pueden leer, autoasignar ni editar rol/estado.
Runtime `service_role`: SELECT/INSERT/UPDATE en perfiles administrativos y solamente
SELECT/INSERT en auditoría. Sin DELETE; auditoría sin UPDATE. FKs con RESTRICT
preservan las referencias; no se fuerza limpieza ni se define retención/purga.
La auditoría mínima no sustituye una política de operación y retención de producción.

`supabase/credenly/tests/admin_permissions.sql` verifica catálogo, FK, grants y
operaciones reales bajo SET LOCAL ROLE authenticated/anon, dentro de una transacción
que termina en ROLLBACK. No crea usuarios Auth. Resultado remoto:
`ADMIN_RLS_GRANTS_AND_CITIZEN_DENIAL_OK`.

Las tablas administrativas quedan vacías. Las cinco tablas ciudadanas y las cuentas
Auth preexistentes conservan conteos/huellas, incluida Valentina. No hay cambios de
correo, relaciones, credenciales académicas, RPC, tablas RAES ni bases institucionales.

Advisor de seguridad posterior: dos avisos INFO nuevos `rls_enabled_no_policy` son
intencionales para estas tablas backend-only; no se añade policy para silenciarlos.
Se mantienen el INFO previo de accesos_compartidos y el WARN previo de protección
de contraseñas filtradas deshabilitada. Sin nuevos WARN/ERROR de estas tablas.
