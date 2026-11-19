# Separación ciudadana de Valentina — resultado verificado

> Informe histórico de su fase. El estado actual de lint, migraciones, PRs y
> validaciones está en [el gate pre-deploy](predeploy-quality-gate.md).

Fecha de inicio: 18 de octubre de 2026. Rama: `feat/frontend-platform`. PR #15 abierto.
**Estado: separación ciudadana validada. Administrador definitivo no creado.**

## Cambios autorizados

Se comprobó que `valentina@yopmail.com` no existía en Auth. Se registraron UUID,
email, IDs de relaciones, conteos y huellas antes de actuar. Se ejecutó
`auth.admin.updateUserById(UUID, { email })`, API oficial Supabase, conservando
exactamente la cuenta y su identidad email. No se escribió SQL en `auth.*`.

Después, al fallar la contraseña anterior, el titular autorizó explícitamente su
restablecimiento. Eligió y confirmó la nueva contraseña en Terminal mediante
entrada oculta; se verificó login real sin imprimirla ni guardarla. Esta segunda
mutación se realizó bajo esa autorización posterior, no bajo el permiso de cambiar
únicamente email. No se modificaron perfiles, verificaciones, vínculos o enlaces.

| Campo | Antes | Después |
| --- | --- | --- |
| UUID Auth | `0b0c1230-994a-4940-9c89-f330975ac9d6` | El mismo UUID |
| Email | `admin@credenly.com` | `valentina@yopmail.com` |
| Cuentas Auth totales | 3 | 3 |
| Coincidencias del nuevo email | 0 | 1 |
| Coincidencias del email anterior | 1 | 0 |
| Perfiles administrativos | 0 | 0 |

Mismo identity_id email: `d9cde9a2-8045-4175-b112-0ebbbfeaa2af`, user_id y provider.
No se creó una segunda cuenta, perfil ciudadano o identidad.

## Relaciones y huellas antes/después

SHA-256 sobre JSON de filas completas ordenadas por UUID, sin publicar el contenido
privado. Las siguientes huellas permanecen idénticas después de cambiar email,
restablecer contraseña, probar web/APIs y comprobar el correo. Se compararon también
las cinco tablas ciudadanas completas; no se alteró ninguna fila.

| Tabla | Conteo de Valentina antes → después | SHA-256 antes = después |
| --- | --- | --- |
| `perfiles` | 1 → 1 | `5b3288bdeae0e1e8102766a46cc2f9f47210bda52888f99e090c8652d2a7f943` |
| `verificaciones_identidad` | 1 → 1 | `96d85ebd47c758d785052c3a0797addc17b4c964401126d6b14079cbf087231d` |
| `vinculaciones_raes` | 1 → 1 | `9f86ad204cb4777a89af3a333e578ffa2cfa1d78991f9f8d1ceb62ea4f13cc80` |
| `comparticiones` | 5 → 5 | `76191fab6eff260196deb0b688d6d557e0424b7db8a10b6e28536f5a828e3d4f` |
| `accesos_compartidos` | 9 → 9 | `417437c20fd87b058ec6c90059d754c412f3e597130859a05c445d58f8d6392e` |

IDs exactos de todas las relaciones y huellas globales en la
[evidencia JSON](../evidence/2026-10-18-valentina-email-separation.json).
Accesos filtrados por los cinco IDs de compartición de la ciudadana. No se probó
la ruta pública durante esta operación para no añadir nuevos accesos.

## Confirmación mediante Yopmail

El primer envío `signInWithOtp`, con `shouldCreateUser:false`, respondió
**429 / over_email_send_rate_limit**. No se relajó el límite ni se cambió SMTP.
Un único reintento posterior fue aceptado con **200** y llegó a Yopmail como
«Supabase Auth / Your sign-in link». Se verificó que el enlace apuntaba al proyecto
Credenly antes de consumirlo.

El enlace realmente entregado se mantuvo solo en memoria y se consumió mediante
la API oficial **verifyOtp**, con resultado **200**, mismo UUID y email nuevo.
Se usó un comprobador local temporal en loopback, con clave publishable únicamente,
validación estricta de origen, entrada oculta y respuesta sin enlaces/tokens.
No se generó un enlace administrativo ni se usó `email_confirm:true` como atajo.
La sesión de comprobación se cerró. El comprobador temporal se retiró al terminar.

`email_confirmed_at` sigue siendo `2026-10-17T16:10:33.921256Z`: es el timestamp
heredado de la cuenta, no una fecha nueva de verificación. La prueba del buzón nuevo
es la entrega en Yopmail y consumo exitoso de ese enlace, registrada por separado.
Captura de resultado sin secretos: `/tmp/credenly-email-confirmed.png`.

Incidencia local corregida: la política no-referrer del comprobador eliminaba el
Origin del POST y su guard devolvía 403 antes de consumir el enlace. Se cambió a
same-origin manteniendo el guard estricto; la comprobación posterior fue exitosa.
No fue un defecto de Credenly API ni se modificó la aplicación para el fixture.

## Login real y rutas ciudadanas

Tras el restablecimiento autorizado:

- Supabase password login: correcto, mismo UUID y email nuevo.
- Login real por el formulario web: correcto.
- GET `auth/me`, `profile`, `identity-verifications`, `raes/link`, `credentials`,
  `shares`: **200** en los seis casos, mediante sesión ciudadana real.
- Web `/onboarding`, `/credentials`, `/credentials/[id]`, `/shares`: contenido
  correcto y cero errores de hidratación; sin sesión en localStorage/sessionStorage.
- Logout web y cierre de las sesiones de comprobación: confirmados.

GET `/api/v1/credentials`: **200**, `source:"RAES"`,
`persistedByCredenly:false`. Credenciales recuperadas:

| Código RAES | UUID | Estado histórico |
| --- | --- | --- |
| RAES-CRD-00000001 | `2921c117-d4ac-4132-9e4d-2c4d87f8c5fc` | REVOCADA |
| RAES-CRD-00000002 | `307a43bd-f9f3-4e1f-9b69-88ae75eb62ad` | ANULADA |

Ambas conservan institución `63829b97-c4d7-4467-a56a-f98c0c1f2c3a`.
Los estados terminales son información histórica válida, no errores de consulta.
El listado ciudadano devuelve las cinco comparticiones existentes, con los mismos
IDs. Sus nueve accesos y el resto de filas conservan las huellas previas.
Sin escrituras académicas, snapshots persistidos, acceso RAES DB o nuevas comparticiones.

## Verificación reproducible y cierre

El operador `services/credenly-api/scripts/verify-citizen-login.mjs` recibe contraseña
oculta, verifica Auth/web/seis GET y rutas ciudadanas y cierra sus sesiones.
Email/UUID son argumentos; no contiene una excepción para Valentina. Sus resultados
sanitizados se incluyen en la evidencia. No guarda traces/HAR/storageState/videos.

```bash
node --env-file=apps/credenly-web/.env.local services/credenly-api/scripts/verify-citizen-login.mjs --email valentina@yopmail.com --expected-user-id 0b0c1230-994a-4940-9c89-f330975ac9d6
```

Se comprobó sintaxis Node del operador y se ejecutó la validación real anterior.
No se cambiaron esquema, RPC o lógica de negocio; no se repiten builds/tests del
producto que ya pasaron para el mismo código. Se vuelve a escanear secretos antes
del commit. Sin contraseñas, tokens, claves ni enlaces de acceso en Git.

**Detención requerida:** no se creó `admin@credenly.com` ni perfil administrativo.
La separación ciudadana está validada; el aprovisionamiento definitivo corresponde
a un siguiente paso autorizado por el titular. No hay merge ni despliegue.

Fuentes: [actualización administrativa](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid),
[verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp) y
[límites Auth](https://supabase.com/docs/guides/auth/rate-limits).
