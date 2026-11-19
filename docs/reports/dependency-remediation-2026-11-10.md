# Remediación de dependencias — PR #16

Fecha: 2026-11-10. Rama `chore/predeploy-quality-gate`, referencia inicial
`5c244cfb163094d121fb5315448e173bfca03601`. Exclusivamente dependencias,
regresiones y evidencia de validación. Sin merge, deploy, cambios en PR #17 ni
llamadas a las bases Supabase remotas.

**Estado actual: audit corregido; PR todavía NO listo para merge.** El CI sin
caché está bloqueado por la antigüedad mínima de Next 16.4.6; véase el diagnóstico
posterior al final. Los PASS locales no se presentan como un CI aprobado.

## Versiones y alcance

| Dependencia | Antes | Después |
|---|---|---|
| Next, cuatro aplicaciones | 16.3.8 | 16.4.6 exacto |
| eslint-config-next | 16.3.8 | 16.4.6 exacto |
| Zod, cinco manifests directos | ^4.6.5 / 4.6.5 | ^4.6.7 / 4.6.7 |
| minimatch, exclusivamente bajo typescript-estree | 10.2.6 | 11.0.1 |
| React / ReactDOM | 19.2.8 | 19.2.8, sin cambios |
| typescript-eslint y su parser | 8.71.2 | 8.71.2, sin cambios |

Fuentes oficiales inspeccionadas: [Next 16.4.6](https://github.com/vercel/next.js/releases/tag/v16.4.6),
[Zod 4.6.6](https://github.com/colinhacks/zod/releases/tag/v4.6.6),
[Zod 4.6.7](https://github.com/colinhacks/zod/releases/tag/v4.6.7),
[minimatch 11.0.1](https://github.com/isaacs/minimatch/releases/tag/v11.0.1).
Los metadatos npm confirman versiones estables y peers de Next compatibles con
React 19.2.8. No se usan canaries, codemods ni actualizaciones generales.

## minimatch: origen y decisión

`pnpm why -r minimatch --json` y el lockfile anterior identifican al padre directo:

```text
typescript-eslint@8.71.2
  -> @typescript-eslint/typescript-estree@8.71.2
     -> minimatch@10.2.6
```

La misma instancia se alcanza desde eslint-config-next y sus consumidores del
parser. El padre exige `^10.2.2`: resolver normalmente el lockfile no permite 11.
Se consultó también el estable más reciente, typescript-eslint/typescript-estree
8.72.2: conserva el mismo rango, de modo que actualizarlo no corrige el advisory.
[Manifest del padre estable](https://github.com/typescript-eslint/typescript-eslint/blob/v8.72.2/packages/typescript-estree/package.json).
No se actualiza ese padre sin beneficio ni se añade minimatch como dependencia directa.

Solo después de comprobarlo se introduce en pnpm-workspace.yaml:

```yaml
overrides:
  "@typescript-eslint/typescript-estree@8.71.2>minimatch": "11.0.1"
```

No alcanza minimatch 3.1.5, 9.0.9 ni otros padres. No es una excepción al audit:
instala una versión corregida y todas las vulnerabilidades siguen bloqueándose.
Revisar y retirar este override cuando se actualice el parser a un rango nativo
corregido; no ampliar el selector automáticamente.

El consumidor inspeccionado llama `minimatch(filePath, pattern, {dot:true})` en
useProgramFromProjectService. Una comparación aislada, fuera del monorepo,
comprobó 192 combinaciones de archivos/patrones con 10.2.6 y 11.0.1: PASS.
La regresión versionada usa el parser real con projectService: obtiene tipos para
archivos normales y ocultos permitidos por `*.ts`, y rechaza un archivo anidado
fuera de esa autorización. No usa mocks de minimatch.

## Lockfile y política de seguridad

Regenerado con Node 24.22.0 / pnpm 12.8.1. Se actualizaron los manifests solicitados,
se resolvió el override estrecho y se refrescó únicamente Zod transitivo dentro de
sus rangos existentes. eslint-plugin-react-hooks y zod-validation-error usan ahora
4.6.7; no se fuerza Zod 4 sobre un consumidor que exija Zod 3.

Cambios transitivos revisados: @next/env, @next/eslint-plugin-next y los ocho
binarios @next/swc siguen 16.4.6; minimatch 11.0.1 incorpora
@isaacs/nonrecursive-glob-match 1.1.0. brace-expansion continúa en 5.0.12.
Las claves peer de zod-validation-error cambian para referenciar 4.6.7; no cambia su
versión. No se actualizaron React, ReactDOM, TypeScript, ESLint, Supabase,
Playwright, PGlite, sharp ni otras versiones ajenas a la remediación.

La allowlist de braces y scripts/audit-dependencies.mjs se conservan byte a byte.
La excepción permanece limitada a su advisory/versión/cadena original y vence
18-11-2026; no se amplía. No se añaden exclusiones de antigüedad de releases ni
otras relajaciones de configuración. La auditoría preliminar devuelve cero avisos,
no solo cero avisos bloqueantes.

## Validación final

Completada desde una copia limpia, inicialmente sin node_modules, .next, dist ni
.env, con entorno filtrado y sin secretos remotos. Los tests DB utilizaron solo
la reconstrucción PostgreSQL/WASM prevista en PR #16. El historial DDL y los
resultados históricos anteriores no se modifican.

| Gate | Resultado |
|---|---|
| Instalación frozen local, con caché de verificación compartida | PASS; CI sin caché bloqueado por antigüedad |
| pnpm audit --prod | PASS, cero avisos |
| pnpm audit:gate | PASS, findings vacío |
| Security/history scan | PASS, cero hallazgos |
| Archivo DDL | PASS, 22 históricos + 5 correcciones |
| Lint completo | PASS, diez workspaces y tooling, reglas tipadas verificadas |
| Typecheck | PASS, next typegen en las cuatro aplicaciones |
| Suite completa | 258/258 PASS |
| Builds | 5/5 PASS: contratos y cuatro aplicaciones |
| Playwright | 26/26 PASS |
| Seguridad DB aislada adicional | 4/4 PASS: RLS, grants, columnas, RPC browser y backend |
| OCR sintético real | PASS, cero escrituras DB |

Las 258 pruebas incluyen dos regresiones nuevas. No se añadió una excepción ni
se ignoró un fallo para obtener estos resultados.
[Evidencia sanitizada](evidence/dependency-remediation-2026-11-10.json) con comandos,
resultados, revisión de paquetes del lockfile e integridad de logs. El CI del nuevo
head se comprueba después de publicarlo; los checks de GitHub corresponden a ese
commit, sin convertir un CI anterior en evidencia del nuevo árbol.

La regresión Zod adicional exige rechazar arrays mayores al máximo antes de
validar elementos: conserva el error esperado `too_big` y comprueba trabajo cero
por elemento. El resto de contratos, conectores y proyecciones upstream conserva
sus pruebas existentes.

La inspección de código no encuentra uso de next/image en las pantallas; no se
introduce un consumidor nuevo de Image Optimization. Los tests browser existentes
cubren CSP/nonce, Server Actions de login, cookies, aislamiento ciudadano/admin,
App Router, no-store, assets y límites OCR. La prueba OCR real usa únicamente
píxeles sintéticos y no afirma autenticidad documental.


## Resultado CI y reproducción sin caché de verificación

El [run 42823532812](https://github.com/SargDev02/credenciales-academicas/actions/runs/42823532812),
para el código del commit 4d7da0b, falló en instalación frozen por
`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. Los gates posteriores del job quedaron
SKIPPED, no PASS. No es un advisory nuevo ni un fallo de los tests funcionales.

La copia limpia inicial no tenía node_modules/.next/dist/.env, pero compartía la
caché global que pnpm usa para recordar verificaciones del lockfile. Incluso un
storeDir/stateDir nuevos conservaban ese PASS almacenado. Al aislar también
cacheDir y exigir verificación, la misma política falla localmente. Esta
limitación de la primera validación se documenta explícitamente; su resultado
local histórico no se sustituye por otro.

La reproducción usó una copia independiente y pnpm 12.8.1 con
`--config.cacheDir=RUTA_NUEVA`, `--store-dir RUTA_NUEVA`,
`--state-dir RUTA_NUEVA`, `install --frozen-lockfile --no-trust-lockfile`.
No desactiva la verificación ni cambia la política del repositorio.

El mínimo por defecto de pnpm es 1440 minutos
([documentación oficial](https://pnpm.io/settings/dependency-resolution#minimumreleaseage)).
Las doce entradas rechazadas son Next/eslint-config-next/@next de 16.4.6. La
publicación más reciente registrada por el runner es Next a
2026-11-09T20:22:06Z. Sus 24 horas se cumplen el 10-11-2026 a las 20:22:06 UTC,
**15:22:06 America/Bogota**. Repetir CI después de las 15:23 de Bogotá, sin
modificar configuración. Cumplir la edad elimina esta condición temporal; solo
una nueva ejecución completa podrá confirmar el PASS final.

No se añadió minimumReleaseAgeExclude, no se redujo minimumReleaseAge, no se
activó trustLockfile y no se cambió la excepción braces. No se altera el workflow
para saltar verificaciones. [Evidencia CI y reproducción](evidence/dependency-remediation-ci-2026-11-10.json).

La remediación de vulnerabilidades está publicada y pasa audit, pero la
aprobación técnica para merge permanece pendiente del CI posterior a la ventana
de antigüedad. No se hace merge ni despliegue.
