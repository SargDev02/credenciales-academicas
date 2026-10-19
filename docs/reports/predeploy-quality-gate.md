# Gate pre-deploy — RAES / Credenly

Revisión 2026-10-19. Rama `chore/predeploy-quality-gate`, base main
`09e977562a11ec305f191ed885185174c5423458`. PR [#16](https://github.com/SargDev02/credenciales-academicas/pull/16)
permanece **Draft**. **Resultado global: BLOCKED para despliegue público.**
El prototipo continúa funcional; no se desplegó ni se fusionó nada a main.
No es una certificación de producción ni una prueba de penetración externa.

## Inventario y baseline verificado

Se revisaron raíz/lockfile/workspaces/scripts, las dos apps, cuatro servicios,
cuatro paquetes compartidos, configs Next/TS, 34 archivos de rutas (40 operaciones),
libs de Auth/DTO/OCR/sharing/conectores, SQL/migraciones/fixtures y documentación.
Se inspeccionaron catálogos reales y Advisor de cuatro proyectos separados.
Las dos webs conservan su lenguaje Figma; no se introdujo un framework visual.

| Workspace | Build declarado | Types | Tests actuales | Integración / navegador / entorno real |
| --- | --- | --- | ---: | --- |
| @raes/contracts | PASS | PASS | 8 | Contratos y validaciones consumidos por APIs/conectores |
| @raes/connector-core | No declara; fuente TS ejecutada por CLI | PASS | 18 | Transporte simulado, transforms, idempotencia y legacy no adoptada |
| @raes/connector-poli | No declara; CLI TS | PASS | 5 | Config/wiring propio; historial real A conservado |
| @raes/connector-udea | No declara; CLI TS | PASS | 5 | Nuevo script explícito; config aislada, CLI y wiring real contra transporte local |
| @raes/api | PASS | PASS | 73 | Auth/roles/scopes/tenant/auditoría; HTTP real y SQL real con rollback |
| @credenly/api | PASS | PASS | 79 | Ciudadano/admin/público; HTTP C/D real, limpieza; OCR local real |
| @raes/web | PASS | PASS | 10 | Browser local y login/roles/lecturas reales con cuenta temporal |
| @credenly/web | PASS | PASS | 19 | Admin local + ciudadano/API real, shares/verificación y limpieza |
| @raes/ui | No declara; consumido por Next | PASS | 8 | Estados, labels, contraste; galerías en cuatro anchos |
| @raes/web-core | No declara; consumido por Next | PASS | 18 | HTTP/config/errores/abort, CSP y límites locales |
| Tooling raíz | N/A | PASS | 13 | Guards de scripts, audit policy, secretos, browser launch y 4 reconstrucciones SQL |

Todos los diez workspaces ejecutan **lint real**. Baseline: 208 tests, cinco builds,
types y 20 browser PASS; lint era no-op, UdeA no declaraba test, no existía CI.
Actual: **256 tests**, cinco builds declarados, types/lint reales y **26/26 browser**.
Los tests raíz fallan si falta test/lint/typecheck en cualquiera de los diez paquetes;
no se ocultan mediante --if-present. --if-present build solo cubre los cinco builds
declarados que corresponden a contracts y las cuatro aplicaciones Next.

## Matriz del gate

| Área | Estado | Evidencia | Riesgo residual |
| --- | --- | --- | --- |
| Build | PASS | Cinco builds posteriores al guard de estado ciudadano | No se ha elegido hosting |
| Types | PASS | Diez paquetes + tooling/configs/operadores; next typegen | TS 5.9.3 se mantiene compatible con lint |
| Lint | PASS | ESLint flat tipado/Next/React; cero warnings | ESLint 9 deprecated por compatibilidad publicada de plugins |
| Tests | PASS | 256 unit/integration/tooling; incluye 4 DDL y UdeA explícito | No es cobertura porcentual ni prueba externa |
| Browser | PASS WITH DOCUMENTED LIMIT | 26 locales; QA real RAES y C/D a 360/768/1024/1440 | Confirmación de correo/SMTP no repetida; sin lectores de pantalla reales |
| Dependencies | PASS WITH DOCUMENTED LIMIT | [Análisis y excepción](predeploy-dependencies.md); prod audit 0 | Un HIGH dev exacto aprobado, vence 18-11-2026; audit completo sigue exit 1 |
| Secrets | PASS WITH DOCUMENTED LIMIT | Fuentes/25 commits recientes/bundles; comparación con secretos locales en memoria | Heurísticas y alcance reciente; no prueba de todo el historial/proveedor |
| Auth | PASS WITH DOCUMENTED LIMIT | Login real, cookies HttpOnly/SameSite/Secure; mínimo 12 y signup RAES cerrado, aprobado | HIBP y CAPTCHA deshabilitados; Auth de instituciones no usado por producto |
| Authorization | PASS | 401/403, perfiles por UUID, scopes/tenant, admin sin acceso ciudadano y viceversa | Service-role sigue siendo privilegio de operador, nunca browser |
| RLS | PASS | Cinco correcciones aprobadas; 0 TRUNCATE browser en cuatro proyectos; tests SQL | Nuevos objetos de supabase_admin requieren grants explícitos/revisión |
| API | PASS WITH DOCUMENTED LIMIT | [40 operaciones revisadas](predeploy-api-security.md); límites, schemas y errores | Listas admin/shares >1000 rechazan; no UI paginada nueva |
| DB | PASS WITH DOCUMENTED LIMIT | Catálogos/constraints/RPC/triggers/Advisor y 11 scripts SQL posteriores | INFO sin políticas intencional; WARN HIBP visible |
| Migrations | PASS WITH DOCUMENTED LIMIT | 22 DDL históricos +5 correctivos; cuatro reconstrucciones vacías | PostgreSQL/WASM 18 vs remoto 17.11; soporte mínimo Auth de prueba |
| Recovery | BLOCKED | [Runbook](../operations.md) y ensayo DDL | HIGH público: falta restore completo de datos/plataforma, RPO/RTO y backup autorizado |
| Concurrency | PASS WITH DOCUMENTED LIMIT | Locks/UNIQUE/RPC; carrera fuente corregida; SQL lifecycle rollback | No ensayo de dos conexiones; puede quedar maestra sin fuente en una carrera documental conflictiva |
| Rate limits | BLOCKED | Límites locales por clase + OCR worker único/45s | HIGH público: sin control compartido entre réplicas/borde ni proxy confiable seleccionado |
| Frontend security | PASS WITH DOCUMENTED LIMIT | CSP nonce, guards server, no almacenamiento web manual, redirects acotados | No se valida infraestructura de despliegue inexistente |
| Headers | PASS | CSP/HSTS/nosniff/frame/referrer/permissions; errores API; assets immutable | HSTS actúa solo en HTTPS; sin preload/includeSubDomains |
| Cache/privacy | PASS | private,no-store HTML/APIs/errores; assets fuera de proxy | Futuro proxy debe preservar política y redactar URLs secretas |
| Accessibility | PASS WITH DOCUMENTED LIMIT | Labels, foco/teclado, landmarks/skip, tablas, aria-current, estados en texto, contrastes AA | QA acotada; no certificación integral WCAG/lector de pantalla |
| Performance | PASS WITH DOCUMENTED LIMIT | 38 chunks JS; sin Tesseract/PGlite browser; lectura por lotes y mapas | Sin carga pública/LCP real; overview hace consultas agregadas independientes |
| Retention | BLOCKED | Propuesta explícita, sin purgas | MEDIUM público: aprobar retención, finalidad y tratamiento de texto OCR persistido |
| Operations | BLOCKED | Recovery/rotación/secretos/observabilidad documentados | MEDIUM público: rotación y recuperación de datos aún no ensayadas; sin SLO/alertas |
| Documentation | PASS | README, architecture, development, frontend, progress, entorno y runbooks | Históricos preservados y rotulados; referencias actuales separadas |
| Identidad real | BLOCKED | Lenguaje documental explícito en UI/API/docs | BLOCKER público: OCR no prueba titularidad ni autenticidad legal/KYC |

## Hallazgos y decisiones

| Severidad inicial | Hallazgo | Resultado |
| --- | --- | --- |
| HIGH | Workers OCR sin capacidad/plazo y dimensiones no acotadas | Corregido: preflight firmas/dimensiones/chunks, sin animación, 8 MiB/16MP/8192px, 1 worker, 45s, limpieza tardía/fallida controlada |
| HIGH | DDL inicial ausente para cuatro proyectos | Recuperado desde historial real, checksums/mapeo, 4/4 reconstrucción y comparación semántica; restore completo sigue separado |
| HIGH dev | braces GHSA-vfj7-8cjw-p6xm introducido por lint oficial | Excepción precisa aprobada, visible, temporal y probada; ningún override global |
| MEDIUM | RLS no elimina grants de TRUNCATE/otros privilegios | Corregido y validado remotamente, sin TRUNCATE real ni cambios de filas |
| MEDIUM | Perfiles SUSPENDIDO/CERRADO no restringían la API ciudadana | Política aprobada: 403 antes de negocio/RAES; estado actual por UUID, onboarding conservado, errores 503 saneados y login web sin sesión residual |
| MEDIUM | Exclusión admin/ciudadano ausente en Data API | Corregido por triggers DB aprobados; UUIDs y relaciones intactos |
| MEDIUM | Carrera de upsert podía reasignar fuente | ON CONFLICT DO NOTHING + comparación del ganador; 409, no reasignación |
| MEDIUM | Sin lint/CI/test propio UdeA/runtime reproducible | Resuelto; CI ejecutada realmente en Linux sin secretos |
| MEDIUM | Cabeceras/cache/código upstream sin validar | CSP/headers/privacy y DTO con proyección; errores sin reflexión, respuesta upstream acotada |
| MEDIUM | Listados truncados y lectura académica sin límite de trabajo | Total exacto, rechazo explícito de parcialidad, límite 10000; búsqueda de versiones lineal |
| LOW | next-env dirty recurrente y docs actuales contradictorias | Generado ignorado + typegen; docs separan estado actual/historia |
| INFORMATIONAL | Versiones más nuevas sin advisory relevante | Revisadas; sin upgrades indiscriminados ni force |

El propietario autorizó por separado: excepción dev, cinco correcciones DB,
mínimo Auth 12/cierre signup RAES, PGlite dev-only y bloqueo ciudadano por estado. No autorizó un proveedor KYC,
servicio pago, purga, rotación de claves reales ni despliegue. Permanecen los
bloqueos públicos de la matriz: no se convierten en PASS por tener tests verdes.

## Validación real y preservación

- RAES: login real temporal, falta de perfil denegada, AUDITOR sin altas, perfiles
  inactivos denegados, ADMIN/SUPERADMIN/AUDITOR reflejados desde DB, dos instituciones
  por API, logout/guard, cero acceso directo DB desde browser y cero académicos mutados.
- Credenly: ciudadano temporal y verificación sintética MOCK_DESARROLLO **sin claim
  de OCR real**, vínculo por flujo normal, GET credentials **200**, dos credenciales:
  `981200b3-a30c-4088-ae09-84b27beab01b` (POLI) y
  `b80fb8d4-6a6c-4453-948a-62018be8b7b6` (UdeA), con procedencia RAES y
  persistedByCredenly false. Compartición/publicación temporal, consulta pública,
  revocación/404 y logout. Cuenta, perfil, verificación, vínculo, share y accesos
  temporales retirados; cinco tablas ciudadanas idénticas antes/después; JWT anterior 401.
- Ninguna cuenta existente se convirtió o reutilizó para los logins. La persona
  maestra, fuentes y credenciales C/D institucionales permanecen. Los tests de API
  escriben auditoría operativa RAES de forma deliberada, sin escritura académica.
- SQL real posterior: seis scripts de permisos/exclusión, cuatro verificaciones de
  grants y lifecycle correction/revoke/annul con rollback: **11/11 PASS**.
- OCR separado: imagen puramente sintética 900x280, preflight y Tesseract local real
  PASS, cero escrituras DB. No es un test de autenticidad documental.
- Fallos de ejecución conservados: la Mac se suspendió (Chrome mostró
  ERR_NETWORK_IO_SUSPENDED) durante un intento remoto y el browser de copia limpia
  agotó su timeout en esa ventana. Limpieza del intento remoto pasó. La repetición
  aislada con caffeinate durante la prueba pasó; no se aumentaron timeouts ni
  se añadieron retries automáticos para ocultarlo.

Evidencia sanitizada en [validation JSON](evidence/predeploy-validation.json),
[ledger DB](evidence/predeploy-approved-changes.json),
[catálogo posterior](evidence/predeploy-db-post-catalog.json) y los resultados SQL. La [consulta final de residuos](evidence/predeploy-final-preservation.json)
confirmó cero Auth/sesiones/perfiles/datos de QA, 32 credenciales/39 versiones/39
eventos RAES y los cinco shares/nueve accesos ciudadanos originales.
Sin contraseñas, tokens, hashes de secretos, capturas privadas ni dumps en Git.

## Calidad visual y rendimiento observado

Se inspeccionaron capturas sintéticas de RAES y Credenly a 360 y 1440; las pruebas
geométricas/navegación cubren también 768/1024. RAES mantiene tabla/nav de gestión;
Credenly tarjetas legibles. Foco visible, mensajes de estado, teclado móvil, texto
de estado, labels, encabezados y reduced motion se conservaron. Contraste calculado:
marca/blanco 7.76, muted/blanco 5.08, muted/fondo 4.73, badges éxito 6.07, revocada
4.64 y anulada 6.40. No hay un modal custom que requiera auditar trampa de foco.

Chunks JS agregados (no carga inicial por página ni benchmark de red): RAES 16,
606125 bytes /189632 gzip; Credenly 22,640434 bytes /203670 gzip. No contienen
runtime Tesseract/PGlite. Inter se sirve localmente; sin analytics externo.
No se afirma rendimiento bajo carga pública ni ausencia absoluta de vulnerabilidades.

## Git y siguiente decisión

Commits por área conservados, sin squash local. El PR #16 se mantiene Draft.
Las correcciones verificadas son revisables; antes de cualquier despliegue público
se necesita resolver identidad, restore completo, control global de abuso y las
decisiones operativas de retención/rotación/contraseñas filtradas. El informe
separa esos pendientes del alcance funcional del prototipo y de la excepción dev.
