# Corrección autorizada y aplicada del usuario Auth restaurado en RAES

Fecha: 2026-11-09. Proyecto nuevo `askqizcwemmydwcgrewp`.

La API Auth devuelve 500 tanto en listUsers como en getUserById. El único UUID
Auth `a17656ca-1950-4ec9-af47-2514178a65ea` existe, con identidad email y perfil
SUPERADMIN / ACTIVO. Cuatro campos restaurados quedaron NULL: confirmation_token,
recovery_token, email_change_token_new y email_change. El resto de la identidad
fue preservado; encrypted_password aún no fue asignado, según lo declarado.

La [guía oficial de Supabase](https://supabase.com/kb/troubleshooting/database-error-saving-new-user-RU_EwB)
identifica este fallo de lectura de registros Auth restaurados/insertados por SQL y
recomienda normalizar NULL a cadena vacía. El operador de reset existente no puede
continuar porque primero consulta la cuenta mediante esa misma API.

Operación mínima propuesta, solo para ese UUID:

```sql
update auth.users
set confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, '')
where id = 'a17656ca-1950-4ec9-af47-2514178a65ea'
  and (confirmation_token is null or recovery_token is null
       or email_change_token_new is null or email_change is null);
```

No crear/recrear usuarios, no cambiar email, UUID, identidades, perfil, rol,
contraseña, relaciones ni académicos. No modificar el esquema Auth ni sus defaults.
Verificar en transacción que toda la fila salvo esos cuatro campos permanece igual;
si algo más cambia, abortar. Después comprobar la API Auth y ejecutar el operador
de reset solicitado, con entrada oculta de la contraseña por el usuario.

Esto es una corrección de datos de restauración, separada de la migración local
`academic_review`. Esta última y el baseline continúan sin aplicar.

## Resultado

El propietario autorizó expresamente esta reparación únicamente para el UUID
indicado. Se ejecutó en una transacción con comprobación de fila Auth (excepto
los cuatro campos), identidades y huellas de todas las tablas públicas. Ningún
otro dato cambió. Los cuatro NULL quedaron normalizados y Auth volvió a responder.
Después el operador oficial restableció la contraseña introducida de forma oculta
por el propietario; login Auth, `/admin/me` y navegador pasaron con el mismo UUID
y SUPERADMIN / ACTIVO. Evidencia sin secretos en
[reconnection-auth-normalization.json](../reports/evidence/reconnection-auth-normalization.json).
