# Diagnóstico de propagación institucional — 2026-10-19

Rama `chore/predeploy-quality-gate`, PR #16 Draft. Revisión de solo lectura de
fuentes y reconciliación RAES; no se ejecutó la sincronización ni se modificaron
datos académicos o cuentas. Las consultas institucionales por API pueden registrar
su auditoría operativa normal.

## Causas verificadas

1. Ambos CLI invocan `synchronize` una vez y finalizan. No hay planificación ni
   vigilancia continua de las fuentes definida en el repositorio. Las APIs y las
   webs no ejecutan esos comandos al arrancar.
2. El único título divergente encontrado pertenece a la credencial histórica
   `SIM-POLI-2025-0001`, origen `7cf56163-1f19-4dce-b096-30f8e02b7b49`.
   La fuente dice VIGENTE; RAES mantiene REVOCADA, versión 3. La clave de alta
   no corresponde a la esperada por el conector. El origen también difiere en
   número de acta y estado, además del título. La fila fuente fue actualizada
   `2026-10-19T14:20:41.153308+00:00`.
3. La política ya aprobada preserva esa alta legacy y su historial mediante
   `existingCredentialsNotAdopted`. Incluso ejecutar el conector no actualizaría
   esa credencial. No se interpreta VIGENTE en origen como autorización para
   revertir una revocación histórica de RAES. No se añadió una excepción por código.
4. La web/cliente Credenly usan `cache: no-store`; GET credentials es dinámico y
   lee RAES. React `cache` deduplica durante el render, no es un snapshot académico
   persistente. La pantalla abierta no tiene actualización automática por push.

## Comprobación real

Se usó el lector de snapshots y `RaesClient.getCredentialState` existentes, con
un guard local que rechazaba cualquier solicitud distinta de GET. Solo se
registraron IDs/códigos técnicos, estados y nombres de campos divergentes; no
contraseñas, tokens, datos documentales, nombres ciudadanos ni títulos completos.

| Institución | Credenciales en origen | Contenido/estado coincidente | Divergentes | Sin alta RAES |
| --- | ---: | ---: | ---: | ---: |
| Politécnico | 13 | 12 | 1, legacy deliberadamente preservada | 0 |
| UdeA | 18 | 18 | 0 | 0 |

Regresión dirigida: `pnpm --filter @raes/connector-core test`, **18/18 PASS**;
incluye preservación genérica de altas ajenas y estados terminales. No se cambió
código de aplicación ni se necesitó una migración.

No hubo fuentes inválidas. Las APIs locales RAES (3001) y Credenly (3002)
respondieron 200 en readiness. No se usó una sesión ciudadana existente ni se
crearon cuentas de prueba para este diagnóstico.

## Acción compatible con el alcance actual

Para probar una corrección normal, usar una credencial propia del conector y
VIGENTE en RAES; ejecutar su CLI después de editar la fuente y recargar la página.
La corrección crea historial en RAES por la API, sin persistencia académica Credenly.
No se corrigió ni reactivó la legacy para conseguir una actualización visual.

Automatizar la ejecución es una decisión operativa separada: definir frecuencia,
proceso responsable, exclusión de ejecuciones concurrentes y tratamiento de errores.
No se activaron tareas en segundo plano ni servicios externos durante esta revisión.
