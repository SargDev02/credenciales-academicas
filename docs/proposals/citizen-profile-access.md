# Decisión aprobada: estados del perfil ciudadano

Hallazgo antes de corregir: `authenticateCitizen` validaba Auth y excluía perfiles
administrativos, pero no consultaba `perfiles.estado`. El esquema admite ACTIVO,
PENDIENTE_VERIFICACION, SUSPENDIDO y CERRADO. Una sesión Auth válida y vínculo RAES
VERIFICADA seguían autorizando credenciales aunque el perfil esté SUSPENDIDO/CERRADO.
No existe actualmente una acción administrativa para cambiar esos estados en UI.

Implementación aprobada por el propietario el 2026-10-19, sin esquema, RPC ni endpoint nuevo:

1. Tras comprobar que el UUID no es administrativo, consultar únicamente estado de
   su perfil, filtrado por UUID autenticado.
2. SUSPENDIDO/CERRADO: 403 CITIZEN_ACCOUNT_RESTRICTED antes de leer o modificar
   datos ciudadanos/consultar RAES. Error de consulta: 503, sin filtrar información.
3. Sin perfil o PENDIENTE_VERIFICACION: permitir Auth/perfil/onboarding como ahora;
   las credenciales siguen exigiendo vinculación VERIFICADA. ACTIVO sin cambios.
4. No usar email/metadata, no modificar estados existentes ni banear cuentas Auth.
5. Tests de estados, metadata falsificada, consulta fallida y aislamiento admin.
   Repetir navegador local y ciudadano sintético real, con limpieza.

La decisión fue confirmada explícitamente: «Confirmar bloqueo de SUSPENDIDO/CERRADO».
El guard aplica esta política en cada solicitud y falla cerrado ante un estado
no reconocido. El login web elimina la sesión local rechazada y muestra un mensaje
específico de cuenta restringida. No se cambian estados de cuentas existentes.

Los enlaces públicos conservan su ciclo de revocación/expiración: no son rutas
ciudadanas autenticadas. Esta aprobación no implica revocar enlaces existentes ni
modificar credenciales académicas.
