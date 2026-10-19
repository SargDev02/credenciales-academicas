# Catálogo y permisos: pre-deploy en curso

Inspección real de solo lectura, 2026-10-19. Sin backups de filas ni secretos.

| Proyecto | Tablas public | RLS | Funciones | Migraciones remotas | Grants TRUNCATE anon/authenticated |
| --- | ---: | --- | ---: | ---: | ---: |
| RAES | 19 | Todas | 8 | 8 | 38 |
| Credenly | 7 | Todas | 2 | 8 | 10 |
| Politécnico | 7 | Todas | 1 | 3 | 14 |
| UdeA | 7 | Todas | 1 | 3 | 14 |

El último número cuenta pares rol/tabla, no tablas diferentes. Se verificó con
`has_table_privilege`, sin ejecutar TRUNCATE. RLS no controla TRUNCATE ni REFERENCES
([PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)). No se
identificó una ruta HTTP que ejecute TRUNCATE; no se afirma explotación remota por
Data API. **MEDIUM: exceso de privilegios** y riesgo ante exposición SQL futura.
Los roles browser carecen de CREATE en public. Las RPC de negocio SECURITY DEFINER
están limitadas a service_role/postgres; los triggers utilitarios aún tienen
EXECUTE público. No se encontró una RPC de negocio ejecutable por anon/authenticated.

**MEDIUM: exclusión ciudadano/admin incompleta en DB.** La API rechaza un UUID
administrativo (incluso inactivo) en flujos ciudadanos. Sin embargo, el INSERT RLS
legado de perfiles verifica únicamente auth.uid() = id y conserva grants de
columnas id/nombres/apellidos. Un administrador puede intentar crear su perfil
propio por Data API sin pasar por ese guard. Esto no eleva su acceso a la API,
pero contradice la separación de perfiles. No se convirtió ninguna cuenta.

## Corrección preparada, NO aplicada remotamente

- `20261019114151_least_privilege_browser_roles.sql` en cada proyecto revoca
  permisos browser de tablas/secuencias/funciones y grants de columnas, conserva
  grants explícitos del backend y revoca defaults de objetos creados por postgres.
  Credenly conserva exactamente sus lecturas RLS y escritura limitada de nombres.
  Los defaults de supabase_admin no se alteran: requieren configuración del
  propietario de plataforma, y todo objeto futuro debe llevar REVOKE explícito.
- Credenly `20261019114224_enforce_credenly_profile_exclusion.sql` rechaza cualquier
  solapamiento preexistente y añade dos triggers con una función interna sin
  EXECUTE browser ni service_role. Serializa por UUID dentro de PostgreSQL y
  comprueba la otra tabla sin usar email/metadata. Solo admite READ COMMITTED en
  esas escrituras: rechaza otras aislamientos para no comprobar snapshots viejos.
  No añade endpoint/RPC de negocio, no mueve perfiles ni cambia UUIDs.

Antes de aplicar persistentemente: revisar alcance, validar transaccionalmente
con ROLLBACK, comprobar ausencia de solapamientos y autorizar la aplicación remota.
Después: rerun grants/RLS/Advisor, pruebas de API/identidades y comparar conteos.
No ejecutar el archivo de bootstrap sobre ninguna base existente.

## Advisor y constraints

INFO `rls_enabled_no_policy`: RAES 18, Credenly 3, instituciones 7 cada una.
La ausencia de políticas browser es deliberada para tablas backend-only; RLS
fail-closed no sustituye revocar grants innecesarios. WARN leaked-password protection
disabled en RAES y Credenly, tratado en el informe de Auth. No se ocultaron warnings.

Credenly tiene UNIQUE separados para usuario_id, raes_persona_id y
verificacion_identidad_id: una carrera de vinculación no puede duplicar estos IDs.
RAES tiene UNIQUE documental y UNIQUE institución/origen de persona_fuentes.
Se corrigió el upsert de la fuente para no reasignar persona_id ante una carrera;
se apoya en el UNIQUE de PostgreSQL y ON CONFLICT DO NOTHING. El perdedor con otro
documento recibe 409. La creación multisentencia aún puede dejar una maestra sin
fuente si pierde esa carrera: no duplica la identidad ni reasigna la fuente, pero
una transacción única sería la mejora mínima si se requiere atomicidad completa.
No se añadió una RPC nueva silenciosamente.

Historial completo, checksums y plan de reconstrucción en
[`supabase/bootstrap`](../../supabase/bootstrap/README.md). Restore aislado aún
pendiente; recuperar DDL no equivale a validar una recuperación.

## Evidencia transaccional ejecutada

Los tests existentes de auditoría, provisioning, administración, RPC de vinculación
y permisos de perfil pasaron (cinco scripts). Las dos propuestas se ensayaron en
cada proyecto con ROLLBACK explícito: **4/4 PASS**; en Credenly ambos intentos
cruzados fueron rechazados antes de INSERT. Ningún perfil fue convertido, ninguna
credencial se modificó y los triggers/grants propuestos no quedaron instalados.
Esto valida los SQL propuestos contra el catálogo actual; todavía no demuestra
una carrera con dos conexiones concurrentes ni una reconstrucción vacía.

Captura de catálogo sin filas: [JSON](evidence/predeploy-db-catalog.json).
Resultados sanitizados: [tests previos](evidence/predeploy-existing-sql-tests.json)
y [propuestas con rollback](evidence/predeploy-proposed-db-tests.json).
