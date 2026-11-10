# Dependencias — revisión pre-deploy en curso

Fecha de revisión: 2026-10-19. No es una aprobación de despliegue.

Baseline antes de añadir lint: `pnpm audit` sin advisories. Tras instalar el
config oficial de Next y sus plugins para lint real, aparece un advisory **HIGH**:

| Paquete | Versión | Cadena | Fix publicado |
| --- | --- | --- | --- |
| braces | 3.0.3 | eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch | Ninguno |

[GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
describe agotamiento de pila con patrones de llaves profundamente anidados.
El registro npm sigue publicando 3.0.3 como última versión; Next plugin 16.4.2
conserva fast-glob. No hay actualización patch/minor que elimine esta cadena.

**Reachability:** dependencia de desarrollo del linter. Los patrones de glob de
las reglas Next y los rootDir de este repositorio son estáticos; ninguna API acepta
patrones para este paquete. No forma parte del runtime instalado con dependencias
de producción. `pnpm audit --prod` reporta cero vulnerabilidades. No se interpreta
esta observación como un parche del paquete ni se rebaja la severidad del advisory.

**Decisión del propietario (2026-10-19):** autorizada una excepción temporal limitada
exclusivamente a este GHSA, versión 3.0.3 y la cadena dev indicada, hasta el
18 de noviembre de 2026. `pnpm audit` continúa mostrando el HIGH y termina en 1;
`pnpm audit:gate` lo muestra como PASS_WITH_DOCUMENTED_LIMIT. Cualquier otra cadena,
versión, advisory MEDIUM/HIGH/CRITICAL o excepción vencida bloquea CI. La excepción
versionada y sus tests impiden aplicarla a runtime u otros advisories. No se usan
`--force`, exclusiones globales, versiones ficticias o un fork no revisado.

ESLint 9.39.5 aparece deprecated; se conserva por compatibilidad publicada de los
plugins oficiales React/import usados por Next 16.3.8, cuyos peers no admiten
ESLint 10. No se fuerza una combinación fuera de esos peers. Config flat con reglas
de TypeScript, promesas con información de tipos, Next, React/hooks e imports.

`pnpm outdated --recursive` también detectó Next 16.4.2, React/DOM 19.3.1,
Supabase JS 2.118.0, Zod 4.6.7 y TypeScript 7.0.2 frente a versiones instaladas
16.3.8, 19.2.8, 2.117.2, 4.6.5 y 5.9.3. No se actualizan todas sin una corrección
demostrada; TypeScript 7 excede el rango soportado por typescript-eslint instalado.
SSR 0.12.7, Tesseract 7, Playwright 1.64.1 y tsx no originaron advisories en el
baseline. Node de validación/CI: 24.22.0 LTS; pnpm: 12.8.1.


## Revalidación y remediación posterior — 2026-11-10

La auditoría del head 5c244cf detectó nuevos avisos en Next, Zod y minimatch.
La remediación acotada y su validación actual se documentan en
[dependency-remediation-2026-11-10.md](dependency-remediation-2026-11-10.md).
Los resultados anteriores se conservan como evidencia de su fecha; la excepción
original de braces no se modifica ni cubre estos otros advisories.
