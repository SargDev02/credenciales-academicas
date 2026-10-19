# Frontend del prototipo

Estado actual 2026-10-19: frontend integrado en main por el squash del PR #15.
La revisión pre-deploy continúa en el PR Draft #16; estado verificable en el
[gate](reports/predeploy-quality-gate.md). Las cifras y QA de fases anteriores
se conservan como evidencia histórica; no sustituyen la validación actual.

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

Copiar el `.env.example` de cada app a `.env.local` (ignorado). Cada aplicación usa
su proyecto Auth independiente. Las webs solo aceptan URL Supabase y una clave
publishable/anon; no hay service role, claves de integración ni `NEXT_PUBLIC_*`.

| App | Variables exclusivas del servidor web |
| --- | --- |
| RAES | `RAES_WEB_SUPABASE_URL`, `RAES_WEB_SUPABASE_PUBLISHABLE_KEY`, `RAES_API_BASE_URL` |
| Credenly | `CREDENLY_WEB_SUPABASE_URL`, `CREDENLY_WEB_SUPABASE_PUBLISHABLE_KEY`, `CREDENLY_API_BASE_URL`, `CREDENLY_WEB_SITE_URL` |

`CREDENLY_WEB_SITE_URL` es el origen confiable para confirmar correo. Registrar
su `/auth/callback` en los redirects permitidos del proyecto Auth antes de probar
confirmaciones por correo. No se cambió la configuración remota de Auth.

```bash
pnpm --filter @raes/api dev       # 3001
pnpm --filter @credenly/api dev   # 3002
pnpm --filter @raes/web dev       # 3000
pnpm --filter @credenly/web dev   # 3003
pnpm typecheck
pnpm test
pnpm lint
pnpm -r --if-present build
pnpm test:frontend:browser
```

Las galerías `/design-system` de ambas apps no requieren conexión a Supabase.
Los flujos integrados sí requieren las APIs y variables reales.

## Auth, permisos y límites de servidor

Login/logout son Server Actions y usan `@supabase/ssr`. Cookies separadas
`raes-web-auth` y `credenly-web-auth`, HttpOnly, SameSite=Lax, Secure en producción,
path `/`. Proxy refresca las sesiones; los Server Components validan `getUser()`
antes de extraer el access token. JWT solo en servidor para llamadas a la API.
Sin Auth SDK en browser ni sesiones en localStorage/sessionStorage. Logout limpia
las cookies aun si falla la llamada remota. Configuración incompleta produce un
mensaje seguro, sin exponer variables o errores internos.

Los Server Components consultan APIs sin caché y comparten lecturas con React cache
en cada render. Los Client Components se limitan a formularios, navegación activa,
confirmación/copia de resultados y recuperación de errores. El HTTP común valida
payloads, sanitiza errores, limita esperas y admite cancelación; no reintenta
mutaciones. Un resultado incierto indica revisar estado/listado antes de reenviar.
No hay acceso frontend a tablas privadas ni persistencia de información académica.

## RAES Web

| Ruta | API utilizada / comportamiento |
| --- | --- |
| `/login` | Supabase Auth RAES + `GET /api/v1/admin/me` |
| `/dashboard` | Métricas derivadas de listados reales, sin estadísticas inventadas |
| `/institutions` | `GET/POST /api/v1/admin/institutions`, filtros locales |
| `/institutions/[id]` | Detalle del listado + POST de integración existente |
| `/api-clients` | `GET/POST /api/v1/admin/api-clients` |
| `/audit` | Explica indisponibilidad de consulta; no accede a DB |

Cambio backend aprobado para RAES: `/admin/me`, cinco campos de perfil y tres roles
explícitos con `authenticateAdmin`; sin cambiar su comportamiento por defecto.
Ver contrato en `docs/api.md`. Login y layout usan ese perfil, nunca metadata.
SUPERADMIN/ADMIN ven altas; AUDITOR solo consultas. Las Server Actions vuelven a
comprobar el rol; cada POST en RAES API sigue siendo la autoridad de autorización.

No existen GET de auditoría, integraciones ni scopes asignados/catálogo. Las pantallas
adaptan la información disponible. Los scopes del alta se introducen explícitamente
separados por comas y RAES valida los permitidos; no se simulan asignaciones. Una
integración puede omitirlos para usar los defaults del backend, mostrando los
permisos confirmados en la respuesta.

Claves nuevas: la acción proyecta únicamente ID/clave/scopes a memoria del componente.
No reenvía el bearer completo devuelto por API. Se muestra advertencia y permite
copiar/cerrar; cerrar, recargar o salir descarta el resultado. No se pueden recuperar.

## Credenly Web

| Ruta | Integración existente |
| --- | --- |
| `/login`, `/register` | Auth Credenly; registro por correo con confirmación |
| `/auth/callback` | Intercambio PKCE; destino fijo al onboarding |
| `/onboarding` | GET/PUT perfil, GET/POST verificación, GET/POST vinculación RAES |
| `/credentials` | `GET /api/v1/credentials`, source RAES y persistedByCredenly false |
| `/credentials/[id]` | Detalle derivado del listado vivo, sin endpoint inventado |
| `/shares` | GET/POST comparticiones y DELETE por ID |
| `/verify/[token]` | GET público de Credenly API, sin sesión/JWT |

Progreso: Cuenta → Perfil → Documento → Verificación → Vinculación → Credenciales.
El OCR existente procesa multipart `documento` en el servidor. La web acepta
JPEG/PNG/WEBP hasta 8 MB; Server Actions se limitan a 9 MB para incluir multipart.
La aprobación documental no acredita autenticidad legal ni KYC. Estados visibles
PENDIENTE/PROCESADA/APROBADA/RECHAZADA/REVISION, sin inventar aprobación o revisión.

Tarjetas del Figma y detalle muestran VIGENTE/REVOCADA/ANULADA; un estado terminal
es información histórica válida, con fecha/motivo disponible. Las fechas sin hora
conservan el día calendario; timestamps se presentan en America/Bogota.

Compartición: campos adicionales de la whitelist del contrato, duración de 1–720
horas, enlace solo en la respuesta de alta para copiar/descartar, listado de estados
y revocación con confirmación. Sin token completo persistido ni recuperación desde
el listado. El link se construye con el origen de la web y la ruta `/verify`.

La página pública traduce respuestas API 200/410 (revocada o expirada)/404 y fallos
sanitizados a mensajes distintos. El estado terminal de la credencial sigue visible.
Los códigos 410 corresponden a Credenly API; la página HTML Next.js muestra su estado
semántico. No es un proxy HTTP que replique todos los códigos de la API.
Información disponible rotulada «Información consultada desde RAES» y estado actual.
Sin indexación, referencias externas, analytics ni referrer a terceros.

## Verificación y evidencia

`pnpm test:frontend:browser`: 12 pruebas públicas en Chrome instalado en macOS,
cuatro anchos; galerías, badges, labels, teclado/focus y overflow. No crea datos.
Los verificadores opt-in siguientes requieren build previo. El proceso operador
recibe las claves de backend desde sus archivos ignorados; esas claves nunca pasan
a Next/browser. Contraseñas aleatorias, JWT y enlaces solo en memoria; sin trazas,
HAR, storageState, videos ni capturas de secretos/documentos.

Desde `apps/raes-web`:

```bash
# API compilada 3101, web compilada 3200 con RAES_API_BASE_URL=http://localhost:3101
node --env-file=.env.local --env-file=../../services/raes-api/.env.local --import=tsx scripts/verify-browser.ts --temporary-admin
# Arranca API fixture 3401 + web 3204: solo las altas son locales
node --env-file=.env.local --env-file=../../services/raes-api/.env.local --import=tsx scripts/verify-provisioning.ts --temporary-admin
```

QA real: sin perfil rechazado, tres roles activos 200, inactivo 403, ausente/inválido
401, tres altas 403 para AUDITOR y visibilidad correcta de formularios. Listados
reales, detalle/filtros/logout/guard. Altas UI en fixture local: tres formularios,
conflicto 409, proyección/descartado de secreto y cambio de rol antes del envío.
Cero instituciones/clientes/integraciones remotas creadas.

Desde `apps/credenly-web`:

```bash
# API fixture local 3402 + web compilada 3205, Auth real temporal
node --env-file=.env.local --env-file=../../services/credenly-api/.env.local --import=tsx scripts/verify-browser.ts --temporary-citizen
# APIs reales: RAES 3101, Credenly 3102 configurada hacia 3101; web 3206 hacia 3102
node --env-file=.env.local --env-file=../../services/credenly-api/.env.local --import=tsx scripts/verify-real-citizen.ts --temporary-citizen
```

QA local: perfil, transporte documental multipart y estados, vinculación, tarjetas,
detalle terminal/vacío, crear/revocar/descartar token, público 200/410/404/503.
QA real: cuenta temporal y fixture documental MOCK_DESARROLLO para identidad C/D,
perfil y vinculación mediante UI/endpoints normales, dos credenciales/instituciones,
source RAES, sin persistencia académica, compartición/público/revocación.
La verificación preparada no se presenta como OCR real. Confirmación de email no
probada de extremo a extremo; no se enviaron correos de QA.

Limpieza: se detiene ante errores, sin forzar FKs. Solo IDs creados por la ejecución.
Se retiran accesos de su compartición, compartición, vínculo, verificación, perfil
y Auth. Verificador real exige huellas idénticas de las cinco tablas Credenly,
Auth 404 y sesión anterior 401. SQL independiente confirmó cero cuentas/sesiones
Auth del prefijo QA en ambos proyectos. IDs/evidencia en `docs/progress.md`.

Incidencias de QA corregidas: esperar contenido tras streaming antes de contar o
capturar tarjetas y evitar revocar de nuevo una sesión ya cerrada por logout. El
usuario residual de ese intento se eliminó normalmente tras comprobar por SQL cero
sesiones/datos ciudadanos. No se forzaron eliminaciones.

## Límites actuales

- Lint real en los diez paquetes y tooling, CI y 248 tests; la limitación histórica
  de scripts ausentes se resolvió. No se borran sus registros de validación previos.
- Los gaps administrativos de RAES (auditoría, listado de integraciones y scopes)
  continúan explícitos; no se crearon endpoints ni accesos directos a DB para UI.
- El PR #15 fue fusionado por squash. PR #16 permanece Draft, sin despliegue ni merge.
- DDL de cuatro proyectos recuperado y reconstruido en PostgreSQL/WASM. Sigue
  pendiente un restore completo de plataforma/datos y la política operativa final.
- Identidad real/KYC, control público de abuso, HIBP gratuito/alternativa autorizada,
  retención aprobada y rotación ensayada siguen separados de la calidad funcional
  del prototipo. No se declara listo para producción.

## Desarrollo mediante IP de la red local

En la propia Mac, usar `http://localhost:3000` (RAES) y `http://localhost:3003`
(Credenly). Acceder por otra dirección puede bloquear el WebSocket HMR de desarrollo.
Para una IP/host de LAN, añadir a los `.env.local` web correspondientes:

```dotenv
RAES_WEB_ALLOWED_DEV_ORIGINS=192.168.1.7
CREDENLY_WEB_ALLOWED_DEV_ORIGINS=192.168.1.7
```

Son listas opcionales de hostnames separados por comas, sin protocolo/puerto.
Reiniciar las webs y recargar la página. No autorizan CORS de las APIs ni cambian
login, permisos o la configuración de producción. Si cambia la IP, actualizar el
valor local. Para confirmar correo desde otro dispositivo, revisar además el origen
confiable y callback Auth documentados arriba; HMR no configura ese redirect.

## Credenly Admin — alcance operativo aprobado

Experiencia separada del ciudadano y de RAES Admin. Usa el Auth del proyecto
Credenly, pero requiere un registro **ACTIVO / ADMIN_CREDENLY** en su propia
`perfiles_admin`, identificado por UUID. Un correo que comienza por admin o una
metadata editada no concede permisos. No existe registro público de administradores.

| Ruta web | Consulta backend Credenly |
| --- | --- |
| `/admin/login` | Auth Credenly + `GET /api/v1/admin/me` |
| `/admin` | `GET /api/v1/admin/overview` + `GET /api/v1/admin/health` en paralelo |
| `/admin/users` | `GET /api/v1/admin/users?page=1` + overview |
| `/admin/verifications` | Conteos documentales de overview |
| `/admin/links` | Conteos de vinculaciones de overview |
| `/admin/shares` | Conteos de comparticiones de overview |
| `/admin/health` | `GET /api/v1/admin/health`, proyecta el readiness existente |

No necesita variables nuevas. Las credenciales de servidor continúan únicamente
en Credenly API; la web llama a sus endpoints. Cookies administrativas
`credenly-admin-web-auth`, separadas de `credenly-web-auth`, con las mismas
protecciones SSR. El proxy refresca solo el ámbito de la ruta. Cada render vuelve
a validar perfil/rol en API. Cerrar administración no cierra la sesión ciudadana
independiente. El login ciudadano valida `/api/v1/auth/me`; una cuenta con perfil
administrativo, incluso inactivo, recibe 403 en todas las rutas ciudadanas protegidas.

Diseño operativo compacto: sidebar de 232px desde 768px, contexto de sección y
nombre/rol del administrador en el header. Por debajo de 768px, navegación
desplegable con las seis rutas; Enter abre y Escape cierra devolviendo el foco al
botón. Los enlaces activos usan `aria-current`. El aviso de solo lectura permanece
visible. El CSS administrativo se carga en `/admin` y no redefine el portal ciudadano.

El resumen muestra cuatro `MetricCard` compartidas de `packages/ui`: título,
total, desglose de estados de la API y enlace de detalle. Columnas: cuatro desde
1200px, dos desde 480px y una por debajo de 480px. La salud global exige readiness
200/ready y las tres dependencias disponibles/configuradas; una consulta de salud
fallida conserva los conteos obtenidos y muestra «Salud no disponible». Las
incidencias conservan su alcance limitado a auditoría administrativa. Cada consulta
muestra hora de Bogotá y permite actualizar manualmente, sin polling ni tendencias.

Las secciones muestran el total y todos sus estados reales, incluidos los ceros.
La tabla de cuentas conserva el UUID completo, botón de copia con feedback, fechas,
confirmación del correo y paginación. El scroll queda dentro de una región
enfocable con instrucciones, `caption` y encabezados `th/scope`; no se infiere
actividad a partir del último acceso. Se mantienen labels, estados con texto y
color, loading y errores sanitizados. «Volver a intentar» refresca la consulta del
servidor antes de restablecer el error boundary. El login administrativo no ofrece
registro ni recuperación por correo.

Se inspeccionaron directamente en Figma Button Primary `1:26`, Input `1:30`, Badge
Vigente `1:34` y Card Credencial `1:40`, incluidas sus capturas. Se reutilizan
Button/Input/Card/Badge, Inter local y los tokens oficiales. Los componentes de
dominio (salud, incidencias, encabezado, navegación, estados y copia de UUID) viven
en `components/admin`; `MetricCard` no contiene lógica de Credenly. Sin framework
visual, dependencias nuevas, assets externos ni modificaciones del archivo Figma.

El panel solo lee: UUID Auth, confirmación de correo y fechas; estados agregados;
salud y hasta diez errores de `auditoria_admin`. No muestra correos, documentos,
imágenes, texto OCR, hashes, sesiones, tokens, credenciales académicas ni identidad
RAES individual. No permite cambiar cuentas, verificar documentos manualmente,
forzar vinculaciones ni revocar comparticiones ajenas. No constituye KYC.

Los conteos son lecturas actuales independientes, no históricos ni una instantánea
transaccional. Fallos producen error, no ceros inventados. Shares revocadas tienen
precedencia sobre expiración; activas y expiradas restantes son excluyentes.
Auth se pagina en bloques de 20 sin inventar un total; una página completa habilita
la siguiente, que podría estar vacía. Auth «configurada» en readiness comprueba
configuración, no un login de prueba. HTTP 200 del wrapper puede incluir
`httpStatus:503` y `not_ready` de su dependencia, mostrados explícitamente.

Las lecturas administrativas exitosas y fallidas se auditan antes de responder.
Si no puede escribirse auditoría, se responde 503 sin entregar datos. No se crean
actores administrativos para registrar denegaciones de ciudadanos o anónimos.
Los errores mostrados solo cubren esta fuente de auditoría; no representan todos
los errores del sistema.

Prueba reproducible **sin cuentas ni escrituras remotas**, después del build,
desde la raíz:

```bash
pnpm test:frontend:browser --project=credenly-admin
```

El comando completo `pnpm test:frontend:browser` incluye las doce pruebas públicas
previas y ocho administrativas. El comando anterior de compatibilidad, desde
`apps/credenly-web`, delega en la misma suite:

```bash
pnpm exec tsx scripts/verify-admin-isolation.ts
```

Arranca API/Web reales compiladas en 3312/3313 y fixtures HTTPS locales en 3433.
Auth/DB/RAES son simulados exclusivamente en memoria. TLS con certificado temporal
confiado solo por esos procesos, sin desactivar validación. Comprueba guards HTTP,
rol/estado, redacción, sesión ciudadana, seis rutas, cookies/logout independientes,
KPIs, estados, paginación, copia de UUID, ready/dependencia caída, fallos parciales,
loading/error/reintento/vacíos y cuatro anchos. No carga `.env` en el
operador ni crea usuarios en Supabase. Contraseña de fixture solo en memoria;
sin trazas/HAR/storageState/videos/capturas de secretos. Las capturas explícitas
del login vacío y del panel con datos sintéticos se guardan únicamente en
`/tmp/credenly-admin-polish-qa` (360 y 1440px). Los errores del proyecto admin no
generan capturas automáticas. La suite comprueba cero escrituras privadas
inesperadas; la auditoría administrativa normal se simula en memoria local.

La suite automática anterior conserva fixtures exclusivamente locales. En una
operación separada y autorizada del 19 de octubre se aprovisionó el administrador
definitivo sintético `admin@credenly.com`, UUID independiente, y se validaron
login Auth/Web real, las seis secciones, auditoría, logout y seis denegaciones
ciudadanas 403. El email ciudadano de Valentina sigue siendo `valentina@yopmail.com`,
con su UUID/relaciones intactos. Ver `docs/authentication.md` y el
[informe del aprovisionamiento](reports/2026-10-19-credenly-admin-provisioning.md).

Escaneo local posterior al build, desde la raíz:

```bash
node scripts/verify-web-boundaries.mjs
```

Lee valores privados de los env ignorados solo en memoria, compara con archivos
versionables y bundles públicos y reporta únicamente conteos. Exige env locales
presentes para que la comprobación no pase vacía. No sustituye un escáner de secretos
histórico ni un análisis lint. Resultado del refinamiento visual: 324 archivos / 38 bundles,
sin valores privados, env/traineddata indexados ni persistencia manual en browser.

Validación del refinamiento administrativo (2026-10-19): `pnpm typecheck` y build
recursivo correctos; `pnpm test` **199/199** (192 anteriores conservados, seis casos
de presentación y uno de MetricCard nuevos); navegador **20/20**. `pnpm lint`
terminaba con exit 0 por `--if-present`, pero ningún paquete definía lint (evidencia
histórica; corregido en la revisión pre-deploy): no se
presenta como análisis estático. Sin cambios de API, Auth remoto, esquema o RPC.

## Controles HTTP revisados en pre-deploy (2026-10-19)

Las dos webs generan CSP con nonce por respuesta, scripts sin unsafe-inline/eval
(en desarrollo se permite eval para Next), frame-ancestors none, form-action self y
connect-src self. Auth y llamadas a APIs permanecen server-side; no se permite una
conexión browser directa a Supabase. style-src conserva unsafe-inline para los
atributos de presentación usados por React/Next. HTML se renderiza dinámicamente
con `private, no-store`; assets `_next/static` y fuentes quedan fuera del proxy.
Se comprobó en navegador que sus scripts reciben el nonce y los assets mantienen
caché immutable. HSTS se emite en producción y solo tiene efecto sobre HTTPS; no
se incluye includeSubDomains ni preload sin decidir el dominio de despliegue.

Ambas APIs emiten cabeceras de seguridad y `private, no-store` para sus respuestas,
incluidos errores. La admisión local por proceso limita OCR POST a 6/min,
verificación pública a 120/min, altas administrativas a 20/min, health a 120/min y
resto de API a 600/min, con Retry-After y 429. No se interpreta x-forwarded-for como
identidad confiable. Es una protección local de recursos, no un límite por persona
ni una defensa distribuida. La instancia OCR admite un worker, sin cola, y un
plazo de 45 segundos; un worker que arranca tarde se termina sin procesar.
