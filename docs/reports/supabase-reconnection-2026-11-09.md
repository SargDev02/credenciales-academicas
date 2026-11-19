# Reconexión Supabase y continuación de revisión académica

Fecha: 2026-11-09. Rama: `feat/raes-academic-review`. PR #16 separado; sin merge, push de esta rama ni despliegue.

## Trabajo preservado al reanudar

Todos los archivos siguientes ya tenían cambios locales antes de esta reconexión. No se descartaron ni se restauraron:

- `apps/raes-web/src/app/(admin)/validations/[id]/page.tsx`
- `apps/raes-web/src/app/(admin)/validations/loading.tsx`
- `apps/raes-web/src/app/(admin)/validations/page.tsx`
- `apps/raes-web/src/components/review-decision.tsx`
- `apps/raes-web/src/lib/academic-review-actions.ts`
- `apps/raes-web/src/lib/academic-review-api.ts`
- `apps/raes-web/src/lib/academic-review-model.ts`
- `packages/connector-core/src/academic-review.ts`
- `packages/connector-core/src/runner.ts`
- `packages/contracts/src/academic-review.ts`
- `scripts/lib/academic-review-db.mjs`
- `scripts/lib/academic-review-fixture.mjs`
- `scripts/test/academic-review.test.mjs`
- `services/raes-api/scripts/academic-review-baseline.ts`
- `services/raes-api/src/app/api/v1/academic-review/detections/route.ts`
- `services/raes-api/src/app/api/v1/academic-review/proposals/route.ts`
- `services/raes-api/src/app/api/v1/admin/academic-reviews/[id]/approve/route.ts`
- `services/raes-api/src/app/api/v1/admin/academic-reviews/[id]/reject/route.ts`
- `services/raes-api/src/app/api/v1/admin/academic-reviews/[id]/route.ts`
- `services/raes-api/src/app/api/v1/admin/academic-reviews/route.ts`
- `services/raes-api/src/lib/academic-review.ts`
- `supabase/raes/bootstrap/20261005041757_initial_raes_schema.sql`
- `supabase/raes/bootstrap/20261005041827_tune_raes_indexes_and_rls.sql`
- `supabase/raes/bootstrap/manifest.json`
- `supabase/raes/migrations/20261109134656_academic_review.sql`
- `apps/raes-web/package.json`
- `apps/raes-web/src/app/(admin)/dashboard/page.tsx`
- `apps/raes-web/src/app/app.css`
- `apps/raes-web/src/components/navigation.tsx`
- `apps/raes-web/src/lib/provisioning-model.ts`
- `package.json`
- `packages/connector-core/src/index.ts`
- `packages/connector-core/src/raes-client.ts`
- `packages/connector-core/src/source.ts`
- `packages/connector-core/src/sync.test.ts`
- `packages/connector-core/src/sync.ts`
- `packages/contracts/src/index.ts`
- `pnpm-lock.yaml`
- `services/connector-poli/package.json`
- `services/connector-poli/src/cli.ts`
- `services/connector-poli/src/sync.ts`
- `services/connector-udea/package.json`
- `services/connector-udea/src/cli.ts`
- `services/connector-udea/src/sync.ts`
- `services/raes-api/package.json`
- `services/raes-api/src/app/api/v1/credentials/annulments/route.ts`
- `services/raes-api/src/app/api/v1/credentials/corrections/route.ts`
- `services/raes-api/src/app/api/v1/credentials/revocations/route.ts`
- `services/raes-api/src/app/api/v1/credentials/route.ts`
- `services/raes-api/src/app/api/v1/sync/campuses/route.ts`
- `services/raes-api/src/app/api/v1/sync/institution/route.ts`
- `services/raes-api/src/app/api/v1/sync/persons/route.ts`
- `services/raes-api/src/app/api/v1/sync/program-campuses/route.ts`
- `services/raes-api/src/app/api/v1/sync/programs/route.ts`
- `services/raes-api/src/lib/api-error.ts`
- `services/raes-api/src/lib/scopes.ts`

El trabajo pausado incluía contratos, esquema/RPC propuestos, bootstrap histórico RAES mínimo para tests aislados, detector, operador de baseline, API y primera bandeja RAES. Habían pasado 18 pruebas SQL aisladas, 12 de conector y typecheck de API/web; quedaban pruebas de rutas/browser/live, documentación y revisión final. Los últimos ajustes locales del esquema deben volver a verificarse. No había commits de esta funcionalidad ni migración/baseline aplicados remotamente.

## Destinos y protección del estado anterior

- RAES: `askqizcwemmydwcgrewp`, organización `faicqklncctthlqdxnoz`.
- Credenly: `xvzylegwuxmxqcgdjjrq`, misma organización.
- Politécnico y UdeA conservan sus proyectos, configuración y datos.
- Los proyectos RAES/Credenly antiguos se conservan intactos para referencia/rollback.
- Solo los cuatro `.env.local` RAES/Credenly podrán cambiar; los secretos locales de integración se conservarán, sin rotación.

## Reconexión y validación real completadas

Se completó el login CLI del perfil independiente `proyecto-gobernacion` y se
verificaron la organización y ambos proyectos mediante Management API oficial.
Las claves se obtuvieron en memoria y se escribieron únicamente en los cuatro
`.env.local` ignorados, con permisos 0600. Ningún secreto se rotó. Los `.env.local`
de ambos conectores se compararon byte a byte y permanecieron iguales.

Variables actualizadas, solo nombres:

- RAES API: `RAES_SUPABASE_URL`, `RAES_SUPABASE_SERVICE_ROLE_KEY`.
- RAES Web: `RAES_WEB_SUPABASE_URL`, `RAES_WEB_SUPABASE_PUBLISHABLE_KEY`, `RAES_API_BASE_URL`.
- Credenly API: `CREDENLY_SUPABASE_URL`, `CREDENLY_SUPABASE_SERVICE_ROLE_KEY`, `RAES_API_BASE_URL`.
- Credenly Web: `CREDENLY_WEB_SUPABASE_URL`, `CREDENLY_WEB_SUPABASE_PUBLISHABLE_KEY`, `CREDENLY_API_BASE_URL`, `CREDENLY_WEB_SITE_URL`.

Los secretos/client IDs Credenly/Poli/UdeA existentes se conservaron. Las tres
autenticaciones reales devolvieron 200. Credenly conservó exclusivamente
`credentials:read` y `persons:resolve`; Poli y UdeA sus siete scopes restaurados.
No se ejecutó sincronización canónica.

| Comprobación local contra proyectos restaurados | Resultado |
| --- | --- |
| RAES `/api/v1/health` y `/api/v1/health/ready` | 200; database up |
| Credenly mismas rutas | 200; database/auth/raes up |
| Login RAES Auth + `/admin/me` + navegador | PASS; SUPERADMIN / ACTIVO |
| Login ciudadano Auth + navegador | PASS; seis rutas API 200 |
| Login Credenly Admin Auth + navegador | PASS; ADMIN_CREDENLY |
| Cookies de ciudadano y admin | Prefijos separados, HttpOnly y SameSite |
| JWT ciudadano → admin / JWT admin → ciudadano | 403 / 403 |
| Cierre de sesiones de prueba | Todas cerradas |

La ruta real de readiness es `/api/v1/health/ready`, no `/api/v1/ready`. Se
corrigió Credenly para consultar realmente Auth; antes solo informaba
`configured`. Cuatro pruebas verifican cada dependencia y la respuesta 503.

### Reparaciones Auth expresamente autorizadas

- RAES `a17656ca-1950-4ec9-af47-2514178a65ea`: cuatro campos Auth restaurados
  NULL impedían la lectura (500). Normalización mínima transaccional a cadena
  vacía, con comparación integral antes/después y sin tocar otros usuarios.
  [Operación y evidencia](../proposals/restored-auth-token-normalization.md).
- El propietario introdujo nuevas contraseñas ocultas mediante operadores para
  ese admin RAES, la ciudadana `0b0c1230-994a-4940-9c89-f330975ac9d6` y el admin
  Credenly `bf79e684-6004-49f2-9ad3-b0ab6105b76f`, cada uno con autorización
  independiente. Los dos últimos se restablecieron solo después de que el
  propietario confirmara que no recordaba sus contraseñas. UUID, emails, roles
  y relaciones se conservaron. No se recrearon cuentas.
- Se restauraron los ajustes previamente autorizados: mínimo 12 en ambos
  proyectos y signup público cerrado solo en RAES. HIBP no cambió.

### Lecturas académicas y datos preservados

La ciudadana conserva persona RAES `e9e8a688-a337-4be9-b965-0eb59be0cdb5`,
credencial `RAES-CRD-00000001` REVOCADA v3 y `RAES-CRD-00000002` ANULADA v2;
las cinco comparticiones se recuperaron por la ruta autenticada.
El cliente real Credenly recuperó además las credenciales VIGENTE 31/32 de la
persona sintética compartida `daf57960-31cb-432b-8e45-684c63651f85`, una por
institución. `source: RAES`, `persistedByCredenly: false`. Se instrumentaron
las llamadas del cliente: tres peticiones RAES API, cero RAES DB, cero bases
institucionales y cero escrituras académicas.

Los conteos académicos restaurados coincidieron: 2 instituciones, 16 sedes,
20 programas, 46 relaciones, 30 maestras, 31 fuentes, 32 credenciales, 39
versiones/eventos/operaciones; 2 integraciones y 1 cliente con sus secretos
y scopes. Secuencia en 32 sin ejecutar `nextval`.

Credenly conserva 4 Auth/identidades, 1 perfil ciudadano, 1 verificación,
1 vínculo, 1 admin, 5 comparticiones y 9 accesos. El manifiesto indicaba dos
perfiles ciudadanos: el propietario confirmó que el segundo era Sergio y que
no debía restaurarse. Se acepta expresamente el conteo 1; no se borró su Auth.
Auditorías y timestamps de uso pueden aumentar por las lecturas reales y logins;
no se deben confundir con duplicación académica.

### Esquema, permisos y migraciones

Comparación semántica read-only con DDL histórico inmutable y correcciones
restauradas previamente autorizadas, reconstruidos en PostgreSQL/WASM aislado:

| Catálogo | RAES | Credenly |
| --- | --- | --- |
| Tablas / columnas | 19 / 181 | 7 / 63 |
| Constraints / funciones | 88 / 8 | 36 / 3 |
| Índices / triggers / policies | 64 / 18 / 1 | 18 / 7 / 6 |
| Comparación de cada área | Exacta | Exacta |

RLS en todas las tablas de aplicación; cero grants de tabla para browser. También se comprobaron los grants de columna: cero en ambos proyectos; las
policies restauradas se conservaron, sin abrir acceso browser innecesario. No se añadieron policies a tablas server-only. La comparación
incluye cuerpos de funciones por SHA, search_path y SECURITY DEFINER.
Se consultó DDL histórico del PR #16 únicamente como evidencia de restauración;
no se mezcló su código, hardening de aplicación ni CI en esta rama.

Los diez registros históricos por proyecto están **YA PRESENTES** semánticamente
con timestamps nuevos. No se ejecutaron `repair`, `db push`, reset ni replays.
La propuesta local `academic_review` es **PENDIENTE Y NECESARIA**, con timestamp
**REQUIERE RECONCILIACIÓN** porque precede al historial restaurado. Solo esa
migración nueva podrá registrarse con una versión posterior; nunca se renumeran
ni reejecutan las históricas. Ninguna migración histórica quedó obsoleta por
una diferencia de timestamp.

El baseline académico sigue **PENDIENTE Y NECESARIO**. Preflight read-only contra
RAES nuevo y ambas fuentes activas: Poli 13 estudiantes/13 credenciales/7
programas/3 sedes/11 relaciones (47 huellas); UdeA 18/18/13/13/35 (97 huellas).
Cero desconocidos; total previsto 144. No crea pendientes ni copia documentos.
Credenly se audita por separado y no forma parte del corte académico.

### Cambios de código de reconexión

Readiness real y cuatro regresiones; opción `--verify-local` del operador RAES;
verificador de navegador local con cookies/logout; verificador ciudadano/admin
con sesiones separadas; guard UUID y comparación de relaciones en reset ciudadano;
operador de reset admin Credenly con UUID/rol obligatorios. La contraseña se
mantiene solo en memoria. No se imprime, persiste ni pasa como argumento.

### Evidencias

JSON sanitizados en `docs/reports/evidence/reconnection-*.json`: comparación de
esquema, clientes, lecturas vivas, logins, normalización y ajustes Auth. No contienen
claves, contraseñas, tokens, documentos, nombres personales ni dumps.

### Límites y trabajo retomado

Revisión académica continúa localmente en la misma rama. Este informe registra el checkpoint previo a la activación. Después se aplicaron
las dos migraciones nuevas y el corte descritos en [revisión académica](../academic-review.md),
sin reejecutar el historial restaurado. Durante la reconexión no se modificaron fuentes institucionales ni proyectos
antiguos, no hubo merge/deploy. La excepción sintética de Poli fue autorizada
posteriormente y se documenta separadamente.
El `site_url` Auth restaurado de Credenly sigue en el default localhost:3000; los
flujos de correo/redirect de confirmación no se validaron en estas pruebas de
contraseña. HIBP y cierre de producción siguen pendientes independientes.
La evidencia de calidad final del nuevo flujo se documentará en `academic-review.md`.
