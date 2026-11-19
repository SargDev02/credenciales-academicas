# Reconciliación de PR #17 con PR #16 integrado — 2026-11-19

PR #17 `feat/raes-academic-review`, originalmente
`f8e865abcfe8a1f3bad64d0368a50aed1d151e96`, incorpora mediante merge commit
main `e356f8d6ce02de58a66ad76ebf599f83e06010d9`. Se conservan los 16 commits
originales de #17 y los 27 de #16. No squash/rebase, merge a main, despliegue ni
acceso a Supabase remoto. El SHA del merge se obtiene con `git log --merges`;
no se incluye dentro de su propio contenido.

## Conflictos y decisiones

Git produjo 16 conflictos, resueltos por archivo. No se aplicó una estrategia
 global ours/theirs.

| Archivo | Resolución |
| --- | --- |
| `apps/raes-web/next-env.d.ts` | Prevalece eliminación #16; generado e ignorado. |
| `apps/credenly-web/next-env.d.ts` | Igual. |
| `services/raes-api/next-env.d.ts` | Igual. |
| `services/credenly-api/next-env.d.ts` | Igual. |
| `docs/development.md` | Gates/lint real #16 y operación académica #17; procedimientos remotos anteriores identificados como históricos. |
| `docs/frontend.md` | Hardening #16 y Validaciones #17; sin recuperar la antigua limitación de lint. |
| `eslint.config.mjs` | Configuración tipada robusta de #16 intacta. Código #17 adaptado a las reglas. |
| `package.json` | Gates #16 más suite browser académica y lint de su configuración. |
| `packages/connector-core/src/raes-client.ts` | Validación/sanitización #16 más leases, propuestas y DELETE de #17. |
| `pnpm-lock.yaml` | Regenerado con pnpm 12.8.1 tras combinar manifests. Frente a main: solo dos enlaces workspace, seis líneas añadidas. |
| `services/connector-poli/package.json` | Lint #16, detector #17. Sin `sync --only` ni scripts de escrituras canónicas. |
| `services/connector-udea/package.json` | Igual, con tests propios #16 adaptados al detector. |
| `services/connector-udea/src/cli.ts` | Runner de detección #17 con configuración aislada #16. |
| `services/credenly-api/package.json` | Lint/dependencias #16 y operador de reset administrativo #17. No se ejecutó el reset. |
| `services/credenly-api/src/lib/raes-client.test.ts` | Regresiones de upstream #16 más lectura viva A/B #17 con payload completo válido. |
| `services/raes-api/package.json` | Tooling #16, baseline/script académico y dependencia workspace #17. No se ejecutó baseline remoto. |

## Incompatibilidades semánticas reconciliadas

- UdeA: `options.ts` y `wiring.test.ts` usan `parseDetectionArgs`/`detect` y rechazan
  `--only`; no se recuperaron `SyncMode`/`synchronize` para satisfacer tests.
- Readiness Credenly: mock completo de `whoami` (id, clientId, nombre, tipo y scopes).
  La validación upstream no fue debilitada.
- Validaciones RAES: carga de datos separada del render para satisfacer lint React
  de #16; se conservan estados de error/404 y controles por rol. Los catches
  diagnósticos opcionales tienen explicación; ninguna regla desactivada.
- Fixture browser: perfiles/estados ciudadanos, paginación, exact count,
  `Content-Range`, proyección de versiones y contratos de #16. Solo transportes
  Auth/PostgREST locales; aplicaciones Next y funciones SQL reales.
- CI: conserva todos los gates/pins/permisos de #16, añade browser académico y
  operadores en modo local explícito. No utiliza secretos ni cuentas remotas.
- OCR: límites/preflight/admisión/timeout/worker #16 y etiquetas completas #17
  permanecen juntos. No se modifica esquema ni se usa OCR externo.

## Una sola reconstrucción DDL

`supabase/bootstrap/manifest.json` conserva el archivo histórico y sus huellas.
Añade las dos evoluciones académicas y sus SHA-256. Orden:

1. 22 migraciones históricas, repartidas entre las cuatro bases.
2. Cinco correctivas de #16: RAES permisos; Credenly permisos y exclusión de
   perfiles; Poli/UdeA permisos. Cada proyecto se reconstruye aisladamente.
3. RAES `20261109161812_academic_review.sql`.
4. RAES `20261109162351_academic_review_preserve_unchanged_catalogs.sql`.

El contenido SQL de todas estas migraciones permanece idéntico a sus ramas de
origen. Se elimina el bootstrap duplicado `supabase/raes/bootstrap/`; sus dos SQL
iniciales ya existen idénticos en el archivo común. La reconstrucción compartida
admite `stage: "hardening"` para comparar el catálogo histórico #16 y por defecto
reconstruye el estado actual. Las pruebas académicas reutilizan esta misma cadena,
con datos de laboratorio en memoria antes de habilitar los guards.

La nueva regresión de composición reconstruye RAES desde cero, comprueba RLS en
sus tablas, conserva los grants browser de #16, restringe cinco tablas académicas
y diez funciones, permite solo las seis entradas de revisión a service_role y
rechaza una escritura canónica directa (`REVIEW_APPROVAL_REQUIRED`). Los tests de
reconstrucción de los otros tres proyectos usan el estado actual y verifican
catálogo, RLS, SQL de seguridad y exclusión ciudadano/admin.

Nada de esto reaplica migraciones a las bases existentes. Estas ya contienen el
esquema académico; Git y la plataforma remota siguen siendo procesos separados.

## Verificación limpia local

Node **24.22.0**, pnpm **12.8.1**. Copia de trabajo limpia inicialmente sin .env,
node_modules, dist ni .next. Entorno filtrado sin secretos remotos. PostgreSQL
PGlite **0.5.8**; browser Chromium/Chrome local. No se añade dependencia.

| Gate | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm security:scan` | PASS, archivos versionables e historial reciente |
| `node scripts/verify-schema-archive.mjs` | PASS: 22 históricas + cinco correctivas + dos académicas |
| `pnpm lint` | PASS, lint tipado de diez workspaces y herramientas, cero warnings |
| `pnpm typecheck` | PASS, incluye `next typegen` en las cuatro apps/servicios Next |
| `pnpm test` | **333/333**: 281 workspaces + 52 herramientas/SQL/operador |
| `pnpm audit --prod` | PASS, sin vulnerabilidades |
| `pnpm audit:gate` | PASS, `findings: []` |
| `pnpm -r --if-present build` | PASS: contracts + RAES API/Web + Credenly API/Web |
| `pnpm test:frontend:browser` | **26/26** |
| `pnpm test:academic-review:browser` | **9/9** |
| Composición/reconstrucción/seguridad cuatro DB locales | PASS; cinco tests de catálogo/composición, más 25 SQL académicos en suite completa |
| OCR real con imagen sintética | PASS, Tesseract local, cero escrituras DB, sin afirmar autenticidad |
| Operador `--verify-completed --local` | PASS, replay y conteos estables; `canonicalWrites: 0` |
| Postcheck `--local` | PASS |
| Reproductor offline del bloque histórico | PASS como reproducción; conserva la indeterminación de la causa antigua |

Next/eslint-config-next **16.4.6**, Zod **^4.6.7**, React/ReactDOM **19.2.8** y
el override exclusivo `@typescript-eslint/typescript-estree@8.71.2>minimatch =
11.0.1` permanecen como en main. No se amplía la excepción braces: sus bytes son
idénticos y venció el 18-11-2026; no interviene en este audit sin hallazgos.

La suite académica prueba detector real compartido → HTTP propuesta → ciudadano
sigue viendo A → aprobación desde RAES Web/Server Action → siguiente GET Credenly
ve B con el mismo UUID. También rechazo, superseded, replay, AUDITOR 403,
responsive/teclado, 429, CSP/nonce, no-store y SUSPENDIDO/CERRADO antes de contactar
RAES. El fixture rechaza y contabiliza toda escritura Credenly; resultado **cero**.
Los tests SQL/unitarios cubren deduplicación, leases/fencing, atomicidad y guards.

Los nuevos modos `--local` se seleccionan antes de leer archivos .env. Su validación
es WASM y no pretende comprobar GoTrue, email, cuentas remotas ni limpieza de Auth
real. Se conservan el modo remoto original y las doce regresiones del operador.
No se ejecutó el modo remoto ni se crearon nuevas cuentas.

## Preservación y límites

Los **22 archivos** de evidencia académica/operador existentes son idénticos a
`f8e865a`; sus SHA están en la evidencia nueva separada. Incluyen el FAIL histórico,
que no se cambia a PASS. La excepción antigua se perdió: su disparador exacto sigue
indeterminado. Esta reconciliación no inventa una causa.

Baseline original: **Poli 47, UdeA 97, total 144**, sin regenerar ni modificar. No
se repitieron fixtures, aprobaciones o modificaciones institucionales remotas.
Valentina/admin y el estado intencional Credenly de cuatro Auth/un perfil ciudadano
no se tocaron; no se vuelve a consultar ni restaurar el perfil de Sergio.

Sin bloqueos locales reproducidos para reconciliar estas ramas. CI se comprueba
sobre el head publicado; un PASS local no se presenta como PASS de GitHub. Se
mantienen los pendientes pre-deploy documentados (identidad real, restore completo,
operación/abuso/retención/rotación y contraseñas filtradas). No listo para producción.

[Resultados e inventario completo](evidence/academic-review-reconciliation-2026-11-19.json).
La lista compara la rama reconciliada con main; no atribuye a esta sesión todos los
cambios originales de #17.
