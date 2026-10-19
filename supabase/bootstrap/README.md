# Reconstrucción de esquema: historial recuperado, validación pendiente

Captura de solo lectura del 2026-10-19 mediante Management API. Estos archivos
recuperan las 22 migraciones **realmente registradas** en los cuatro proyectos.
No contienen filas ciudadanas, Auth, secretos ni fixtures académicos. `scopes.sql`
es el diccionario público de permisos; no concede permisos a ningún actor.

**Nunca ejecutar este directorio sobre proyectos existentes.** No es una nueva
cadena de migraciones incrementales. No se renumeró ni reparó el historial remoto.
Las migraciones locales anteriores siguen conservadas; `manifest.json` relaciona
cada versión remota con su archivo local cuando existe y fija SHA-256 del archivo
recuperado. No ejecutar ambas cadenas sobre la misma base.

Faltaban en Git: los dos DDL iniciales de RAES, los dos de Credenly y las tres
migraciones de cada institución. Cuatro migraciones posteriores de RAES y dos de
Credenly usan timestamps distintos en Git y remoto (consultar manifest). También
se preserva la migración histórica que completa tipo/categoría de versiones: tiene
un UPDATE de backfill, pero no exporta ningún dato. Sobre una base vacía no hay
filas que modificar. Se conservan los cuerpos DML de las RPC.

## Procedimiento de ensayo aislado (todavía no ejecutado)

1. Crear cuatro proyectos Supabase locales/aislados vacíos. Deben proporcionar
   `auth.users`, `auth.uid()`, roles `anon`, `authenticated`, `service_role`,
   extensión pgcrypto y los componentes de plataforma Supabase. Un PostgreSQL
   desnudo no equivale a Supabase. No conectar el ensayo a proyectos existentes.
2. Verificar `node scripts/verify-schema-archive.mjs`. Ejecutar, por proyecto,
   solamente los archivos de su lista en `manifest.json`, en ese orden, con un
   cliente SQL que falle al primer error (`psql -v ON_ERROR_STOP=1`). No continuar
   tras un error ni usar `--include-all` contra una base existente.
3. En RAES ejecutar después `raes/scopes.sql`. Las políticas de acceso y los
   defaults de grants deben revisarse explícitamente: los defaults Supabase que
   se observaron conceden demasiado a roles browser. Ver informe de DB antes de
   exponer Data API. Esta recuperación no convierte esos grants en seguros.
4. Ejecutar los tests SQL transaccionales versionados, volver a inventariar
   columnas/constraints/índices/triggers/RPC/RLS/ACL y comparar con la captura.
   Documentar cualquier diferencia; no copiar datos ni modificar UUIDs remotos.
5. Crear usuarios Auth por API administrativa oficial y perfiles por sus tooling
   soportados. Los secretos se generan nuevamente; no pueden restaurarse desde
   hashes. Los fixtures C/D requieren una carga sintética explícita separada
   documentada en `supabase/fixtures`; no forman parte del DDL ni son necesarios
   para arrancar las aplicaciones.
6. Probar ida y vuelta mediante conectores y APIs solo con datos sintéticos.
   Destruir el entorno aislado tras conservar únicamente evidencia sanitizada.

**Estado: BLOCKED para afirmar restore reproducible.** Se recuperó el material
faltante y su correspondencia, pero aún no se ensayó en una plataforma Supabase
vacía ni se probó restauración de datos. Esta Mac no tiene PostgreSQL/Docker
instalados. Seleccionar/provisionar un entorno aislado es el siguiente paso; no
se sustituyó por una reconstrucción de las bases reales.
