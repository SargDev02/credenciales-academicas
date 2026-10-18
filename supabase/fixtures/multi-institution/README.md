# Fixture multiinstitución C/D — PR #14

Datos de desarrollo aprobados el 2026-10-18. No contienen datos personales reales.
Se insertan **solo** tres filas en cada fuente (estudiante, matrícula y credencial).
No hay DDL, cambios de RLS, actualizaciones, borrados ni inserciones directas en RAES.
Las sedes, programas y relaciones existentes se reutilizan sin modificarlos.

Identidad compartida: `CC` / `SYNTH-CD-20261018-001`, nombres `Sintetica Multiinstitucion`.
Sin correos, fecha de nacimiento ni documentos/archivos adjuntos.

| Dato | Institución A — Poli | Institución B — UdeA |
| --- | --- | --- |
| Proyecto | `fswppckzhvpcbybslnop` | `taoapbewllieuephaxsy` |
| Estudiante | `a0182026-1018-4000-8000-000000000001` | `b0182026-1018-4000-8000-000000000001` |
| Matrícula | `a0182026-1018-4000-8000-000000000002` | `b0182026-1018-4000-8000-000000000002` |
| Credencial fuente | `a0182026-1018-4000-8000-000000000003` | `b0182026-1018-4000-8000-000000000003` |
| Código de estudiante y credencial | `SYNTH-POLI-CD-20261018-001` | `SYNTH-UDEA-CD-20261018-001` |
| Relación programa-sede | `317936ce-a820-4eda-b433-64c57439e1a3` | `021f89b1-4bb3-44de-913d-18672ed46611` |
| Programa | `SIM-POLI-INF`, Ingeniería Informática | `SIM-UDEA-PSI`, Psicología |
| Sede | `RIO` | `YAR` |

Estudiantes activos; matrículas activas con ingreso `2026-08-01`, periodo `2026-2`.
Credenciales `CERTIFICADO_ESTUDIOS`, `VIGENTE`, emisión `2026-10-18`, títulos
`Certificado sintetico multiinstitucion POLI` / `Certificado sintetico multiinstitucion UDEA`.
Descripción: `Fixture de desarrollo PR 14, casos C/D. Sin datos personales reales.`
Los demás campos opcionales quedan nulos; timestamps usan los defaults del esquema.

## Aplicación

`poli.sql` y `udea.sql` se ejecutaron una vez, en sus proyectos respectivos, mediante
`supabase db query --linked --file <ruta-absoluta>` con CLI 2.81.3 y perfil institucional.
Cada archivo verifica el NIT, la relación existente y ausencia de colisiones antes
 de insertar dentro de una transacción. Una segunda aplicación aborta: los fixtures
no hacen upsert ni adoptan datos existentes. No son migraciones de producción.

Antes de aplicarlos se comprobó que el documento no existía en A, B ni RAES.
La integración hacia RAES se realiza exclusivamente con `connector-poli` y
`connector-udea`; repetir la sincronización es la prueba de idempotencia.
El verificador y resultados se documentan en `docs/development.md` y `docs/progress.md`.
