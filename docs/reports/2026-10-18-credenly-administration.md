# Informe de cambios importantes: administración y separación de cuentas en Credenly

**Fecha:** 18 de octubre de 2026.
**Estado original:** diagnóstico y propuesta; alcance mínimo aprobado e implementado después, según el bloque de actualización siguiente.
**Alcance original del informe:** documentación. La implementación posterior autorizada se registra en `docs/progress.md`; la separación real de cuentas sigue pendiente.

## Actualización tras aprobación

Se implementaron modelo administrativo Credenly separado, auditoría mínima, guard
por UUID/rol/estado, introspección y panel operativo de solo lectura. Las dos nuevas
tablas se aplicaron con RLS/grants mínimos; no se crearon cuentas ni se cambió el
correo ciudadano. El diagnóstico previo y la propuesta que siguen se conservan
como contexto; los contratos y límites vigentes están en `docs/frontend.md`,
`docs/authentication.md`, `docs/database.md` y `docs/api.md`.

Valentina conserva su UUID, correo y relaciones. La cuenta administrativa definitiva
no existe todavía; requiere primero confirmar un correo ciudadano controlado.

## 1. Objetivo

Credenly debe contar con una administración propia para supervisar su operación.
El correo `admin@credenly.com` debe identificar una cuenta administrativa real,
con permisos definidos en el backend, y no la cuenta ciudadana de Valentina.

Se deben conservar el perfil, la verificación documental, la vinculación RAES y
las comparticiones de la ciudadana. El administrador no debe heredar esos datos
ni consultar credenciales como si fuera su titular.

## 2. Estado comprobado antes de implementar el alcance aprobado

Se revisaron arquitectura, tablas documentadas, autenticación ciudadana, rutas de
Credenly API y layout web. Se consultó además el proyecto Supabase Credenly en
modo de solo lectura, sin obtener ni imprimir contraseñas, hashes o tokens.

| Elemento | Resultado observado |
| --- | --- |
| Proyecto Supabase Credenly | `rleocqxvahtbswclqmif` |
| Cuenta Auth revisada | `admin@credenly.com` |
| Identificador Auth | `0b0c1230-994a-4940-9c89-f330975ac9d6` |
| Perfil asociado | Valentina, perfil ciudadano |
| Correo confirmado | Sí |
| Estado del perfil | ACTIVO |
| Vinculación RAES | VERIFICADA |
| Administración propia implementada en Credenly | No |

Actualmente `authenticateCitizen` valida la sesión de Supabase Auth. No implementa
un rol administrativo de Credenly. `GET /api/v1/auth/me` devuelve identidad básica,
no permisos administrativos. El layout existente presenta navegación ciudadana.

Por tanto, que un correo comience por `admin` no le concede privilegios. Cambiar
la contraseña de esta cuenta tampoco corrige la asociación con Valentina.

## 3. Separación entre administración RAES y administración Credenly

| Responsabilidad | RAES | Credenly |
| --- | --- | --- |
| Instituciones, integraciones y clientes API académicos | Administración propia existente | Sin autoridad para administrarlos |
| Credenciales, versiones e historial académico | Fuente de consulta académica | Consulta mediante RAES API, sin almacenamiento académico |
| Cuentas ciudadanas y perfiles | No administra las cuentas de Credenly | Responsabilidad de Credenly |
| Estado del OCR, vinculaciones y comparticiones ciudadanas | Sin acceso implícito a datos privados ciudadanos | Supervisión operativa propuesta |
| Salud de cada aplicación y errores de integración | Operación de RAES | Operación de Credenly |

No se propone centralizar todos los permisos en RAES. Las dos aplicaciones siguen
usando proyectos Auth y bases físicamente separados.

## 4. Estado objetivo de las cuentas

| Cuenta | Finalidad | Asociación permitida |
| --- | --- | --- |
| `admin@raes.com` | Administración RAES | Perfil administrativo RAES |
| `admin@credenly.com` | Administración Credenly | Perfil administrativo Credenly independiente |
| Cuenta ciudadana de Valentina | Consultar y compartir sus credenciales | Perfil ciudadano actual y su vinculación RAES |

El uso de `admin@credenly.com` como identificador del prototipo no demuestra
control del buzón. Antes de usarlo para entrega o recuperación real por correo,
se debe verificar su control; si es una cuenta sintética, debe identificarse como
tal y no presentarse como una cuenta lista para operar en producción.

El correo definitivo de Valentina queda **por definir y verificar**. No se inventa
una dirección que pueda pertenecer a otra persona ni se confirma un buzón ajeno.
Antes de ejecutar cambios se debe confirmar la naturaleza y titularidad de esta
cuenta/dataset y la dirección ciudadana controlada que la sustituirá.

La cuenta administrativa propuesta tendrá su propio UUID de Auth. No recibirá
el perfil, el documento ni la vinculación académica de Valentina. Su asociación
con un rol se resolverá por el UUID y un registro administrativo confiable, nunca
por comparación del correo, por el texto del nombre o por `user_metadata` editable.

## 5. Plan de separación que preserva datos

La ruta preferida, sujeta a autorización de ejecución, es:

1. Identificar y registrar las relaciones actuales de la cuenta ciudadana:
   perfil, verificaciones, vínculo y comparticiones. Preparar referencia de
   recuperación y comprobar restricciones de unicidad/FK.
2. Definir una dirección ciudadana controlada para Valentina y completar el
   procedimiento de cambio/confirmación de correo aplicable a esa cuenta.
3. Conservar el UUID ciudadano actual al cambiar su correo. Así se preservan las
   relaciones por usuario; no se copian identidades ni se reasignan registros.
4. Solo cuando `admin@credenly.com` quede libre de la asociación ciudadana,
   crear una cuenta Auth administrativa independiente y su perfil administrativo.
5. Verificar sesiones, permisos, trazabilidad y ausencia de cambios en los datos
   ciudadanos y académicos. Gestionar las sesiones afectadas mediante Auth.
6. Documentar identificadores y resultado, sin registrar contraseñas ni tokens.

No se debe convertir el UUID ciudadano actual en administrador, renombrar su
perfil a “Administrador” ni transferir su vínculo a una cuenta nueva para aparentar
la separación. Si no puede conservarse el UUID durante el cambio de correo, se
requiere un plan adicional explícito antes de mover relaciones.

Esta entrega no ejecuta ninguno de esos pasos de cambio de datos.

## 6. Perfil y permisos administrativos propuestos

Se recomienda separar el perfil administrativo del perfil ciudadano. Una opción
mínima es una tabla `perfiles_admin` **en el proyecto Credenly**, vinculada al UUID
Auth y con rol y estado controlados exclusivamente por el servidor. El nombre y
el esquema definitivo deben revisarse antes de implementar la migración.

El primer rol propuesto es `ADMIN_CREDENLY`, con alcance operativo limitado.
No hace falta incorporar varios roles hasta definir responsabilidades reales.
Un auditor de solo lectura puede plantearse después, si el alcance lo requiere.

Controles necesarios para la implementación:

- Validar sesión, existencia del perfil administrativo y estado activo en cada
  endpoint administrativo. Ocultar botones es únicamente una ayuda de interfaz.
- Mantener separados los flujos ciudadanos y administrativos: una cuenta solo
  administrativa no debe obtener acceso ciudadano por el simple hecho de tener
  una sesión Auth válida.
- Impedir que un ciudadano se asigne roles o active su propio perfil administrativo.
- Conservar el principio de mínimo acceso: el administrador operativo no recibe
  acceso general a documentos, credenciales o datos personales de ciudadanos.
- Registrar las operaciones administrativas autorizadas con actor y resultado,
  sin contraseñas, sesiones, imágenes documentales ni secretos en logs.
- Mantener service role exclusivamente en servidor; ninguna consulta browser a
  tablas privadas de RAES ni acceso Credenly → RAES DB.

Esto supone cambios de esquema, autorización y posiblemente nuevas rutas. Se
requiere aprobación específica antes de crear migraciones, RPC o endpoints.
La aprobación anterior de `/admin/me` fue para RAES y no autoriza su equivalente
ni un sistema de roles nuevo en Credenly.

## 7. Panel operativo inicial propuesto

El primer panel debe responder si Credenly funciona correctamente, empezando por
consulta operativa y evitando acciones sobre identidades que aún no estén definidas.

| Área | Información útil | Límite inicial |
| --- | --- | --- |
| Salud | Disponibilidad de Credenly API y sus dependencias | Reutilizar health/readiness existentes; no exponer configuración privada |
| Registro | Cuentas confirmadas o pendientes y errores de registro | Datos mínimos; no mostrar contraseñas o sesiones |
| Verificación documental | Cantidades/estados y fallos de procesamiento | Sin afirmar autenticidad legal ni habilitar aprobación manual automática |
| Vinculación | Estados y errores de comunicación con RAES | Sin cambiar identidades ni forzar vinculaciones |
| Comparticiones | Estados y errores del servicio | Sin recuperar tokens completos ni sustituir el control del titular |
| Errores operativos | Incidentes sanitizados y fecha de última comprobación | Sin SQL, claves o datos académicos en logs/pantallas |

La eliminación actual de imágenes tras OCR impide asumir que un operador podrá
revisar el documento original desde el panel. Conservar imágenes o introducir
revisión/validación manual cambiaría el alcance de identidad, almacenamiento y
retención: debe estudiarse y autorizarse por separado.

Tampoco se proponen acciones para editar, emitir, revocar o anular credenciales
académicas desde Credenly. Esos procesos conservan su procedencia institucional.

Las pantallas, métricas y nuevos contratos de administración descritos aquí son
**propuestas**, no endpoints disponibles. Deberán documentarse y probarse antes
de integrarlos; no se simularán datos ni se consultarán tablas privadas desde web.

## 8. Usuarios, correo y recuperación de acceso

En el proyecto Credenly:

- `auth.users`: cuenta, correo y hash de contraseña administrados por Supabase Auth.
- `public.perfiles`: datos y estado del perfil ciudadano.
- `public.verificaciones_identidad`: resultado de la verificación documental.
- `public.vinculaciones_raes`: referencia a la identidad RAES.
- `public.comparticiones` y `public.accesos_compartidos`: enlaces y sus accesos.

La configuración revisada permite registro por correo y requiere confirmación.
La solicitud de envío existe, pero no se ha probado entrega de correo extremo a
extremo. Un buzón inventado no demuestra que el usuario pueda confirmar la cuenta;
es necesario disponer de la dirección y comprobar proveedor/entrega/callback.

Se añadieron utilidades locales de recuperación para RAES y Credenly, con entrada
oculta, confirmación y verificación de login. No conceden roles ni separan cuentas.
El informe no contiene contraseñas, tokens ni claves. No se infiere que una
contraseña haya cambiado solo porque la herramienta quedó preparada.

## 9. Comprobaciones de aceptación para una futura implementación

1. `admin@credenly.com` identifica un UUID administrativo independiente y muestra
   un perfil administrativo real; no presenta la identidad de Valentina.
2. Valentina accede con su correo ciudadano confirmado y conserva su UUID,
   verificaciones, vinculación y comparticiones previas.
3. Sesión ausente/inválida produce 401; ciudadano sin rol administrativo y
   administrador inactivo reciben 403 en rutas administrativas.
4. Ni un correo con nombre “admin” ni metadata editable permiten elevar permisos.
5. Una cuenta administrativa no puede consultar credenciales como Valentina ni
   apropiarse de su identidad o enlaces.
6. El backend aplica los permisos en cada solicitud, incluyendo llamadas directas
   que eviten la interfaz.
7. El panel presenta indicadores reales y errores sanitizados. Las funciones que
   no tengan endpoint aprobado quedan explícitamente pendientes.
8. No se introducen credenciales académicas en Credenly ni accesos directos a RAES DB.
9. Se verifican sesiones afectadas, recuperación y referencias antes/después, sin
   pérdida de datos ni secretos versionados.

## 10. Decisiones pendientes y orden de trabajo

| Orden | Decisión o trabajo | Estado |
| --- | --- | --- |
| 1 | Informe y diagnóstico de la asociación actual | Completado, solo lectura |
| 2 | Confirmar cuenta/dataset y correo ciudadano controlado de Valentina | Pendiente |
| 3 | Aprobar alcance administrativo mínimo y cambios de esquema/API | Pendiente |
| 4 | Preparar separación de cuentas y recuperación verificable | Pendiente |
| 5 | Implementar autorización/backend y pruebas de aislamiento | Pendiente |
| 6 | Ejecutar separación autorizada y verificar conservación de datos | Pendiente |
| 7 | Integrar panel operativo y validar permisos/UI con APIs reales | Pendiente |

No se ha implementado el administrador de Credenly ni corregido la asociación de
correo en esta entrega. El resultado es el plan concreto para realizar ese cambio
sin confundir una cuenta ciudadana con una cuenta administrativa. Se mantienen los
límites de no despliegue, no merge y no declaración de preparación para producción.

## Referencias del repositorio

- [Arquitectura](../architecture.md).
- [Bases de datos](../database.md).
- [Autenticación y recuperación local](../authentication.md).
- [Frontend y límites de validación](../frontend.md).
- Código actual: `services/credenly-api/src/lib/auth.ts`,
  `services/credenly-api/src/app/api/v1/auth/me/route.ts`,
  `services/credenly-api/src/lib/profile.ts` y layout ciudadano en
  `apps/credenly-web/src/app/(citizen)/layout.tsx`.
