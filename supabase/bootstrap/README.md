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
3. Aplicar después los cinco archivos correctivos `postBaselineMigrations` del
   manifest, solo al proyecto indicado, en orden de versión. Esos archivos coinciden
   con las nuevas versiones remotas, sin duplicar los SQL del archivo histórico.
   El encabezado PROPOSAL describe su estado al redactarse; fueron aprobados y
   aplicados el 2026-10-19, según el ledger de evidencia.
   En RAES ejecutar después `raes/scopes.sql`. Las políticas de acceso y los
   defaults de grants deben revisarse explícitamente: los defaults Supabase que
   se observaron conceden demasiado a roles browser. Las cinco correcciones revocan grants browser sobrantes. Revisar defaults de
   supabase_admin y todo objeto nuevo antes de exponer Data API.
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

## Ensayo reproducible ejecutado

`node --test scripts/test/schema-bootstrap.test.mjs` reconstruye cuatro bases
PostgreSQL/WASM vacías con PGlite 0.5.8 (dependencia de desarrollo aprobada). No abre
red, no lee .env y no incorpora PGlite al producto/browser. Las migraciones se
aplican literalmente, sin omitir DDL. Se comparan tablas/RLS, columnas y defaults,
constraints y sus definiciones, índices, triggers, políticas, firmas/search_path
y cuerpos de funciones (SHA-256 de código) con el catálogo remoto. Se ejecutan los
tests SQL de permisos y exclusión de perfiles con UUIDs sintéticos locales.

**4/4 PASS**. PGlite usa PostgreSQL 18; remoto usa 17.11. Se normaliza únicamente
la aparición de NOT NULL como constraint de catálogo `contype=n` en PG18; la
nulabilidad de todas las columnas se compara por separado. No se omite una
constraint funcional diferente. El ensayo prueba el DDL y permisos con un soporte
mínimo de auth.users/auth.uid/roles. No incluye GoTrue, PostgREST, Storage, correos,
concurrencia entre conexiones ni un restore de datos/backups. El ensayo integral
de Supabase y la recuperación de datos siguen pendientes; no se presenta como
una recuperación certificada ni se borró/recreó ninguna base remota.
