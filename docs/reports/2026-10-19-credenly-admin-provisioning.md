# Administrador definitivo de Credenly — prototipo

> Informe histórico de su fase. El estado actual de lint, migraciones, PRs y
> validaciones está en [el gate pre-deploy](predeploy-quality-gate.md).

Operación autorizada del 19 de octubre de 2026, 00:42–00:44 America/Bogota.
Repositorio `SargDev02/credenciales-academicas`, rama `feat/frontend-platform`,
PR #15 abierto. Sin merge ni despliegue.

## Identidad creada y alcance

| Campo | Resultado |
| --- | --- |
| Email Auth | `admin@credenly.com` |
| UUID nuevo | `bf79e684-6004-49f2-9ad3-b0ab6105b76f` |
| Nombre | Administrador Credenly |
| Perfil | `public.perfiles_admin`, mismo UUID nuevo |
| Rol / estado | `ADMIN_CREDENLY` / `ACTIVO` |
| Ciudadano protegido | `0b0c1230-994a-4940-9c89-f330975ac9d6`, `valentina@yopmail.com` |
| UUID simultáneamente ciudadano/admin | **0** |

Creación mediante [API oficial Supabase Auth Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
seguida de INSERT con service role en `public.perfiles_admin`. No se modifica
`auth.*` con SQL. `email_confirm:true` está autorizado exclusivamente para esta
cuenta sintética de operador: **confirmación administrativa, no comprobación de
control de un buzón**. No se envían correos ni se presenta como verificación ciudadana.

La contraseña fue introducida dos veces por el titular en Terminal, con entrada
oculta, y pasó la política 12–256 caracteres. Solo permaneció en memoria durante
la creación y validación. No se registra en argumentos, archivos, evidencia o Git.
Tampoco se guardan JWT, refresh tokens, claves, hashes de contraseña, trazas,
HAR, videos, capturas del login ni storageState.

## Precheck y operador

`services/credenly-api/scripts/provision-credenly-admin.mjs` es una herramienta
genérica de operador, sin importaciones desde runtime/API/web. Argumentos:
`--email`, `--nombres`, `--apellidos`, `--protect-evidence`, `--output` opcional y
orígenes locales de API/Web. `--check` realiza solo lectura. Requiere env de
servidor y configuración pública de la web del mismo proyecto Supabase.

Antes de actuar, y nuevamente después de introducir la contraseña:

- Inventario Auth completo y colisión case-insensitive: correo destino libre;
  **3 cuentas** existentes, ninguna reutilizada.
- `perfiles_admin` y `auditoria_admin` existen, ambas con **0 filas**.
- Valentina conserva UUID/email y cero perfil administrativo. Sus relaciones,
  IDs y SHA-256 completos coinciden con la evidencia de separación anterior.
- Las aplicaciones locales están disponibles para la validación posterior.

Auth y Postgres no forman una transacción. Si falla el perfil, el operador solo
compensa un UUID nuevo demostrado por la respuesta de createUser y ausente del
inventario previo. Comprueba que no hay perfil o relaciones ciudadanas, verifica
identidad y elimina únicamente ese Auth; exige después 404 y perfil ausente.
Una respuesta ambigua, perfil presente, relaciones inesperadas o limpieza fallida
detiene el proceso sin forzar FKs ni reintentar automáticamente. En esta ejecución
no hubo fallo parcial ni compensación. Nueve tests locales cubren estas ramas.

La cuenta actual **ya está creada**: no ejecutar de nuevo para intentar adoptarla
o restablecer su contraseña. Una colisión aborta; nuevas cuentas requieren una
autorización específica. Uso genérico, desde la raíz:

```bash
pnpm --filter @credenly/api admin:provision \
  --email operador@dominio \
  --nombres Administrador --apellidos Servicio \
  --protect-evidence ../../docs/evidence/2026-10-18-valentina-email-separation.json \
  --output /tmp/credenly-admin-provisioning-result.json --check
```

La evidencia protectora identifica al ciudadano; ningún UUID ciudadano está
hardcodeado en la herramienta. Para una ejecución mutante autorizada, retirar
`--check` y usar Terminal interactiva. No acepta contraseñas por pipes/CLI/archivo.

## Validación Auth y HTTP reales

Login con contraseña contra Supabase real: correcto, UUID administrativo nuevo.
Las llamadas se realizaron contra Credenly API local con esa sesión real.

| Endpoint GET bajo `/api/v1/` | HTTP |
| --- | --- |
| `admin/me` | 200; cinco campos exactos del perfil esperado |
| `admin/overview` | 200 |
| `admin/users` | 200 |
| `admin/health` | 200; readiness 200/ready |
| `auth/me` | **403** |
| `profile` | **403** |
| `identity-verifications` | **403** |
| `raes/link` | **403** |
| `credentials` | **403** |
| `shares` | **403** |

Readiness: DB up, Auth configured, RAES up. Auth configurado no equivale a la prueba
de login; el login se verificó por separado. Totales reales: perfiles 2,
verificaciones 1, vínculos 1, comparticiones 5. Las seis denegaciones conservaron
idénticas las tablas ciudadanas y la auditoría: **cero escrituras** por esos GET.

No se crearon perfil ciudadano, verificación, vínculo, compartición o acceso para
el UUID administrativo. No se consultaron credenciales con otra identidad ni
enlaces públicos de Valentina; no hubo escrituras académicas ni asociación RAES.

## Web y auditoría reales

Formulario real en `http://localhost:3003/admin/login`: login correcto con la
contraseña aún en memoria. Se comprobaron nombre Administrador Credenly, rol,
dashboard coincidente con los cuatro totales API y las seis rutas `/admin`,
`/admin/users`, `/admin/verifications`, `/admin/links`, `/admin/shares` y
`/admin/health`, incluida navegación mediante enlace.

Cookie `credenly-admin-web-auth` HttpOnly, sin cookie ciudadana. Browser solo
contactó el origen web; cero localStorage/sessionStorage y cero errores de
hidratación detectados. Logout web correcto, cookie retirada. Sesión HTTP cerrada
con `signOut({scope:'local'})`. Consulta SQL posterior independiente:
**0 sesiones Auth** para el nuevo administrador. No se tocaron sesiones de Valentina.

Auditoría real: **25 entradas**, todas con
`actor_id = bf79e684-6004-49f2-9ad3-b0ab6105b76f`:

| Acción | Entradas |
| --- | --- |
| ADMIN_PROFILE_READ | 10 |
| OPERATIONS_READ | 8 |
| AUTH_ACCOUNTS_READ | 2 |
| HEALTH_READ | 5 |

Solo campos existentes de actor/acción/resultado/recurso/fecha/ID; sin email,
contraseña, JWT o payload privado. No se modifica el esquema de auditoría.

## Conservación de Valentina

| Relación | Antes / después | IDs y SHA-256 |
| --- | --- | --- |
| Perfil ciudadano | 1 / 1 | Idénticos |
| Verificación | 1 / 1 | Idénticos |
| Vínculo RAES | 1 / 1 | Idénticos |
| Comparticiones | 5 / 5 | Idénticos |
| Accesos compartidos | 9 / 9 | Idénticos |

Las cinco tablas **completas** también conservan sus huellas. UUID/email,
confirmación, alta, actualización y último acceso de las tres cuentas Auth
preexistentes no cambiaron. Auth pasa de 3 a **4 cuentas** únicamente por el nuevo
administrador. No se cambió contraseña, sesión, perfil o identidad ciudadana.
La evidencia exacta está en
[`2026-10-19-credenly-admin-provisioning.json`](../evidence/2026-10-19-credenly-admin-provisioning.json),
comparada con la evidencia de separación del 18 de octubre.

## Calidad e incidencias

- Sintaxis Node correcta y **9/9** tests del operador incluidos en `pnpm test`.
- `pnpm typecheck` correcto; `pnpm test`: **208/208**, conserva los 199 previos.
- Login/API/Web reales aprobados con esta cuenta; sin cambios de código de
  producto, por lo que no fue necesario repetir los builds de la fase visual.
- `pnpm lint` exit 0, pero sin scripts por paquete: no es análisis lint real.
- Escaneo de límites/secretos realizado antes de commits; resultado en progress.
- El MCP conectado no tenía permiso para una consulta SQL auxiliar. El CLI
  enlazado intentó IPv6 inaccesible. La comprobación posterior se completó mediante
  Management API HTTPS con el perfil CLI autorizado, consulta de solo lectura y
  credencial obtenida del llavero exclusivamente en memoria. Sin cambios de red,
  esquema, perfiles CLI o configuración Auth; no se imprimió la credencial.

Administrador del prototipo validado. No se declara listo para producción.
Persisten identidad/autenticidad real, recuperación/baselines, operación/retención/
rotación, protección de contraseñas filtradas y lint por paquete.
