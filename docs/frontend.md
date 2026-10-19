# Frontend del prototipo

## Arquitectura y alcance

`apps/raes-web` y `apps/credenly-web`: Next.js 16.3.8, React 19, App Router y
TypeScript. Se construyen por separado, sin despliegues. `packages/ui` ofrece
presentación sin lógica RAES/ciudadana; `packages/web-core` ofrece HTTP tipado,
errores sanitizados, timeout/cancelación, configuración y destinos de retorno.

## Figma

Fuente: [Proyecto Integrador](https://www.figma.com/design/c9AfXPKUI4ClSj2Bqwkb1d/Proyecto-Integrador---Credenciales-Acad%C3%A9micas).
Se inspeccionaron por MCP contexto de código y screenshots de los siete nodos:

| Componente | Nodo | Implementación |
| --- | --- | --- |
| Button / Primary | 1:26 | Button primary, 44 px, radio 12 px |
| Button / Secondary | 1:28 | Button secondary, borde neutral |
| Input / Default | 1:30 | Input/FormField, 44 px, radio 10 px |
| Badge / Vigente | 1:34 | Badge success con texto visible |
| Badge / Revocada | 1:36 | Badge danger con texto visible |
| Badge / Anulada | 1:38 | Badge warning con texto visible |
| Card / Credencial | 1:40 | CredentialCard, padding 18/20, radio 16, gap 10 |

Tokens originales en `packages/ui/src/styles.css`: marca #254EA4, texto #111825,
muted #636F84, borde #DAE0EA, superficie #FFFFFF y estados #139151/#D12525/#C27D0F.
Se mantienen Inter y escalas 12/18, 14/22, 18/26. Los badges originales miden 100 px
de alto: la variante `design` conserva esa geometría; `compact` (30 px) extiende el
sistema para tablas. Verde/ámbar de texto se oscurecen sobre sus fondos suaves para
contraste AA; los tokens originales siguen disponibles. No se usan frameworks UI,
assets pagos ni URLs temporales Figma. El archivo Figma no fue modificado.

## Responsive y accesibilidad

Base fluida para 360/768/1024/1440 px, labels explícitos, controles nativos, foco
visible, enlaces de salto, mensajes semánticos y movimiento reducido. Los estados
siempre tienen texto, no solo color. Galería `/design-system` en ambas apps: datos
rotulados de demostración y ninguna consulta académica.

## Variables y comandos

Copiar el `.env.example` de cada app a su `.env.local` ignorado. URL Supabase y
clave publishable/anon corresponden exclusivamente al proyecto de esa aplicación:
`RAES_WEB_SUPABASE_URL`, `RAES_WEB_SUPABASE_PUBLISHABLE_KEY`, `RAES_API_BASE_URL`;
y equivalentes `CREDENLY_*`. No se admiten claves service_role. Son variables del
servidor web; no se exportan tokens al JavaScript del navegador.

```bash
pnpm --filter @raes/web dev       # 3000; API RAES 3001
pnpm --filter @credenly/web dev   # 3003; API Credenly 3002
pnpm typecheck
pnpm test
pnpm lint
pnpm -r --if-present build
```

## Contratos y limitaciones verificadas de RAES

Disponibles: GET/POST `/api/v1/admin/institutions`, GET/POST
`/api/v1/admin/api-clients`, POST `/api/v1/admin/institutions/{id}/integrations`.
El detalle puede derivarse del listado sin inventar una ruta API.

No hay endpoint de perfil/rol del administrador: `/auth/whoami` corresponde a
integraciones institucionales, no a usuarios administrativos. El backend consulta
`perfiles_admin` internamente. Tampoco existen GET de auditoría/integraciones ni
scopes asignados en el listado de clientes. No hay acceso directo a esas tablas
desde frontend, ni roles inferidos desde `user_metadata`.

La primera RAES Web permite lectura a los tres roles válidos. Las altas según rol
esperan la decisión de API descrita al final; no se modifica backend sin aprobación.
Auditoría e integraciones no consultables se explican en pantalla; no se inventan
estadísticas, scopes ni listados. Credenly integrado espera el reporte de este bloque.

## Primera RAES Web de lectura

Rutas reales: `/login`, `/dashboard`, `/institutions`, `/institutions/[id]`,
`/api-clients` y `/audit` (disponibilidad explicada, sin consulta de datos inexistente).
`/` redirige al resumen. Los listados se solicitan una vez por render mediante
React cache; los filtros usan los datos recibidos y el detalle se deriva del listado.
Los contadores describen registros visibles, no totales globales no ofrecidos por API.
No existen formularios de alta activos mientras no se conozca el rol desde la API.

### Sesión

Login/logout son Server Actions. `@supabase/ssr` usa cookies con namespace
`raes-web-auth`, HttpOnly, SameSite=Lax, Secure en producción y path `/`. No hay
cliente Supabase en browser ni localStorage/sessionStorage para sesiones. El Proxy
renueva tokens; el servidor verifica `getUser()` antes de usar el JWT de la sesión
para consumir RAES API. No confía en el objeto de sesión sin verificación ni en
metadata. La API vuelve a validar perfil activo y permisos. Los errores de acceso
no muestran SQL ni mensajes internos. Las respuestas autenticadas no se cachean.
Logout borra también las cookies locales aunque falle la revocación remota.

Los únicos Client Components específicos son formulario de login, navegación
activa y botón de recuperación de errores. El resto es Server Components. No se
serializan JWT ni claves al árbol de componentes del cliente. Credenly todavía
no tiene integración de sesión ni flujo ciudadano; solo su Foundation visual.

### Validación de navegador

```bash
pnpm test:frontend:browser
```

Requiere Google Chrome instalado en macOS y builds previos. Playwright reutiliza
o inicia las webs de QA en 3200/3203; las pruebas públicas no crean datos remotos.
La prueba de teclado del login requiere el `.env.local` de RAES Web configurado.
No se guardan traces, vídeo, HAR ni storageState. Las capturas públicas quedan en
`test-results/` (ignorado). Se prueban galerías, labels, teclado/foco y ausencia de
overflow en 360/768/1024/1440 px.

La comprobación real autenticada es un script **de operador**, fuera del runtime
web y opt-in. Usa temporalmente la configuración backend solo en su proceso QA;
ninguna clave de servidor se entrega al proceso de la web ni al browser:

```bash
# Backend RAES compilado en 3101, web compilada en 3200 con RAES_API_BASE_URL=...3101.
# Desde apps/raes-web; solo para el dataset de desarrollo autorizado.
RAES_WEB_TEST_BASE_URL=http://localhost:3200 RAES_TEST_API_BASE_URL=http://localhost:3101 \
node --env-file=.env.local --env-file=../../services/raes-api/.env.local --import=tsx scripts/verify-browser.ts --temporary-admin
```

Crea una cuenta Auth sintética, comprueba rechazo sin perfil, añade únicamente su
perfil AUDITOR, inicia sesión real, compara filas contra la API, prueba filtros,
detalle, logout/guard y los cuatro anchos. Contraseña y JWT permanecen en memoria.
Después elimina únicamente su perfil/cuenta y exige Auth 404 y ausencia del perfil.
Si falla la limpieza, se detiene sin forzar eliminaciones. No modifica instituciones,
clientes, integraciones ni información académica. Diagnósticos de fallo sanitizados
y capturas locales en `/tmp/frontend-qa`; sin claves ni contraseñas en los informes.

En el desarrollo se corrigió un selector del verificador que confundía el
anunciador de rutas Next.js con un error de acceso; se esperó el mensaje concreto
antes de habilitar el perfil de prueba. Las cuentas de los intentos se limpiaron.

### Decisión necesaria para altas

Propuesta concreta, **sin implementar**: GET `/api/v1/admin/me`, protegido con
`authenticateAdmin(request, ["SUPERADMIN", "ADMIN", "AUDITOR"])`, respuesta
`data: { id, nombres, apellidos, rol, estado }` del perfil validado. No devuelve
secretos ni cambia tablas/RPC. Permitiría habilitar formularios para SUPERADMIN/ADMIN
y mantener AUDITOR de lectura; la autorización final seguiría en cada endpoint.
Antes de implementarlo se solicita aprobación conforme al límite de cambios backend.
Los gaps de auditoría/listados/scopes se mantienen explícitos; no se proponen
nuevas consultas a base de datos desde la web.

## Resultado de este bloque

- Typecheck y builds de las dos webs, contratos y backends correctos.
- `pnpm test`: **138/138** (21 frontend/utilidades + los 117 anteriores).
- Playwright público: **12/12** en Chrome, cuatro resoluciones.
- Verificador Auth/RAES real: sin perfil DENIED, AUDITOR OK; dos instituciones,
  datos reales, logout correcto, cero storage sensible y cero errores de hidratación.
- QA final `7f98bf61-89b4-45d0-ae35-3c3b39fee33d` eliminado: SQL independiente
  confirmó cero usuarios/sesiones/perfiles; tampoco quedan cuentas Auth del prefijo QA.
- Claves privadas, JWT, env privados y traineddata ausentes de archivos versionables;
  los bundles de navegador de ambas apps no contienen secretos de los backends.
- `pnpm lint` termina correctamente pero sigue sin scripts por paquete. No se
  presenta como análisis estático. El código se formateó, sin introducir un framework UI.
- PR #15 Draft; sin merge, despliegue ni cambios en backend, esquema o RPC.
