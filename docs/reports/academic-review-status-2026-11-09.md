# Reconexión y revisión académica — resultado del prototipo

Fecha2026-11-09. Funcionalidad validada sobre RAES/Credenly restaurados, sin merge
ni despliegue. El informe conserva la incidencia del operador final y distingue
HTTP real, integración local y replay RPC remoto; no declara preparación para producción.

| Punto solicitado | Resultado |
| --- | --- |
| 1. Rama/Git | feat/raes-academic-review, desde main09e9775; cambios agrupados en commits, PR#16 sin mezclar |
| 2. Trabajo previo | Los56paths existentes se preservaron; inventario completo en evidence/academic-review-file-inventory.json |
| 3. Trabajo nuevo | Reconexión/Auth/readiness, contratos/SQL, baseline, detectores, APIs, Validaciones, cobertura SQL/browser, operador y postcheck, fix OCR autorizado y documentación |
| 4. Proyectos nuevos | RAES askqizcwemmydwcgrewp; Credenly xvzylegwuxmxqcgdjjrq; organización faicqklncctthlqdxnoz |
| 5. Instituciones | UdeA intacta. Poli conserva sus registros previos: solo3filas nuevas autorizadas y títuloA→B de su nueva credencial. Proyectos antiguos intactos |
| 6. Entorno | Solo4env ignorados RAES/Credenly; nombres debajo. Env y secretos de conectores conservados, sin rotación |
| 7. RAES health/ready | HTTP200/200, database up, ruta real /api/v1/health/ready |
| 8. Credenly health/ready | HTTP200/200, database/auth/raes up mediante comprobaciones reales |
| 9. Credenly→RAES | Cliente existente y ciudadano real200; A mientras B pendiente, B en siguiente GET aprobado; sourceRAES/persistedByCredenlyfalse, sin snapshots ni RAES DB directo |
| 10. Poli→RAES | whoami200, detector final14personas/14credenciales,0propuestas ycanonicalWrites0 |
| 11. UdeA→RAES | whoami200, detector final18/18,0propuestas ycanonicalWrites0 |
| 12. Login RAES | SUPERADMIN/ACTIVO, mismo UUID a17656ca-1950-4ec9-af47-2514178a65ea; reset específico autorizado, Auth/API/browser PASS, perfil intacto y logout |
| 13. Logins Credenly | Ciudadano/Admin PASS; cookies separadas, cruces403, sesiones cerradas. Temporales de prueba eliminadas |
| 14. Conteos | RAES30→31maestras,31→32fuentes,32→33credenciales,39→41versiones/eventos/operaciones. Cred4Auth/1perfil/1verificación/1vínculo/5shares/9accesos conservados |
| 15. Migraciones remotas |10históricas por proyecto preservadas; RAES añade20261109161812 y20261109162351; Credenly no añade DDL |
| 16. Baseline |47huellas Poli +97UdeA =144inmutables, dos cortes;0desconocidos y0pendientes iniciales |
| 17. Clasificación | Históricas YA PRESENTES. Revisión nueva PENDIENTE Y NECESARIA, timestamp REQUIERE RECONCILIACIÓN resuelto solo para ella. Corrección de catálogos nueva/aplicada; ningún histórico obsoleto por timestamp ni replay/repair/reset |
| 18. Calidad | ESLint real0errores, typecheck/builds correctos,270/270tests (25SQL incluidos),26/26browser; RLS/grants/advisors y exclusión HTTP real comprobados |
| 19. Commits | Separados por reconexión, esquema/contratos, conectores/baseline, API, web/browser, fixture/operación, OCR autorizado, postcheck y documentación; listado exacto en git log |
| 20. Limitaciones | Último bloque del operador resume salióFAIL, después de HTTP A/B y limpieza; postcheck independiente PASS. Replay remoto porRPC/service_role/ROLLBACK, HTTP replay local. Causa fina del fallo final no reproducida; diagnóstico ampliado. Producción/PR#16 pendientes separados |

## Variables actualizadas, exclusivamente nombres

- RAES API: RAES_SUPABASE_URL, RAES_SUPABASE_SERVICE_ROLE_KEY.
- RAES Web: RAES_WEB_SUPABASE_URL, RAES_WEB_SUPABASE_PUBLISHABLE_KEY, RAES_API_BASE_URL.
- Credenly API: CREDENLY_SUPABASE_URL, CREDENLY_SUPABASE_SERVICE_ROLE_KEY, RAES_API_BASE_URL.
- Credenly Web: CREDENLY_WEB_SUPABASE_URL, CREDENLY_WEB_SUPABASE_PUBLISHABLE_KEY,
  CREDENLY_API_BASE_URL, CREDENLY_WEB_SITE_URL.

## Cambios de datos exactos

Poli: estudiante fef04b81-da0a-42b3-8298-14ef89b2dd25, matrícula
b41a55b6-db8d-4b1f-acc5-0e77a92a12d9 y credencial
094615f8-10d9-495f-8233-dcacb0fb8c55. DocumentoCC/SYNTH-RVW-20261109-001,
códigoSYNTH-POLI-REVIEW-20261109-001. Reutilizó ofertaSIM-POLI-INF/RIO sin modificarla.
Únicamente su nuevo títuloA cambió aB; updated_at institucional se actualizó normalmente.
UdeA: ninguna escritura. [Manifest y estado final](../../supabase/fixtures/academic-review/README.md).

RAES: nueva persona77cf8d08-fd62-42ac-94bf-404a653b7fec y una fuente Poli;
credencial3611d73f-e7bc-47a9-96cc-45e77ac47dc7 / RAES-CRD-00000033, VIGENTE v2.
Incorporación19cccf59-e73e-45b2-ac3b-915fbf9bd8ed y corrección
7cdec780-ff39-4ca9-99cf-a8e742eff025 APROBADAS;0pendientes. Cada aprobación añadió
una versión/evento/operación. Los32credenciales previos y sus UUID/historia permanecen.
No hubo inserciones canónicas directas ni reactivación de terminales.

Cortes y144huellas congeladas no contienen documentos/payloads. Nuevo scope
academic-review:submit (8→9), dos asignaciones institucionales (14→16), sin rotar
secretos. Credenly conserva exclusivamente credentials:read/persons:resolve.
Auditoría RAES final170 frente a145 restauradas (incluye lecturas/corte/propuestas/
decisiones); Credenly79 frente a74, por verificaciones administrativas. Son cambios
legítimos; no se confunden con duplicación académica.

Credenly: dos cuentas temporales de prueba distintas, ambas eliminadas con identidad,
sesiones, perfil, verificación, vínculo y comparticiones confirmados en cero. La
primera paró por el parser OCR, la segunda confirmó OCR201/confianza0.93 e identidad
correcta, vinculación y lecturas reales. Cuenta Valentina y admin existentes intactas.
Segundo perfil Sergio no restaurado por decisión explícita del propietario; su Auth
no se eliminó. Fuente académica siempre RAES; ninguna persistencia académica Cred.

## Incidencias y evidencia

El parser confundía NO dentro de NOMBRES con una etiqueta. Fix mínimo autorizado:
etiquetas completas; ocho regresiones nuevas, sin bajar umbrales ni modificar
verificaciones anteriores. El operador comprobó la identidad esperada y nunca
vinculó el documento erróneo. Evidencias antes/después preservadas.

El segundo operador pasó HTTP A→B y limpió, pero salióFAIL en su bloque final.
No se modifica ese artefacto para fingir éxito. Dos repeticiones diagnósticas y el
postcheck final comprobaron0propuestas; RPC replay conservice_role/ROLLBACK devolvió
replayedtrue y conservó las huellas de once tablas. No se presenta como replayHTTP
remoto. El checker independiente terminó exit0 y puede repetirse sin crear cuentas:

```bash
pnpm --filter @raes/api exec node scripts/verify-academic-review-postcheck.mjs
```

Evidencia exacta en evidence/academic-review-live-first-attempt.json,
academic-review-live-resume-attempt.json y academic-review-live-postcheck.json.
Sin secretos, contraseñas, tokens, documentos reales, dumps ni traineddata.

RLS/grants: todas las tablas de aplicación protegidas,0grants browser de tabla y
columna,0EXECUTE browser en revisión. Advisors soloINFO server-only sin policy y
WARN HIBP conocido; no se abrieron policies ni servicios pagos. El site_url Auth
restaurado de Credenly sigue localhost:3000: flujos de correo/redirect no ensayados.
Persisten identidad real, recuperación, retención/rotación/operación y gateCI/lint
por paquete delPR#16; PGlite no reemplaza restauración Supabase ni pruebas de carga.

Guías: [revisión académica](../academic-review.md),
[reconexión](supabase-reconnection-2026-11-09.md), [progreso](../progress.md).
