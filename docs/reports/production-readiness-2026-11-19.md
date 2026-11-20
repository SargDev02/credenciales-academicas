# Readiness del piloto cerrado — 2026-11-19

Base main `d48c772485d56e4d06696c4ce3b67f5a3761332d`, con PR #16 y #17
integrados. Rama `chore/production-readiness`. El propietario eligió **piloto
cerrado con datos sintéticos**. Esta revisión no autoriza despliegue ni oferta
pública con información real. No se contactaron bases Supabase remotas, enviaron
correos reales, modificaron usuarios, ejecutaron fixtures remotos, regeneraron
baselines, rotaron claves o contrataron servicios.

## A. Implementado y listo en el repositorio

La [matriz de auditoría](../production/README.md#auditoría-y-clasificación) distingue
lo que ya estaba resuelto, lo resuelto en código y las acciones externas. Se
conservan revisión académica transaccional, RLS, mínimos privilegios, exclusión
ciudadano/admin, AUDITOR de lectura, CSP con nonce, no-store, límites OCR,
parser de etiquetas completas y validación de RAES vivo desde Credenly.

### Configuración y autenticación

- Validación estricta de los seis procesos: orígenes HTTPS, ningún fallback
  productivo a localhost, secretos propios, claves browser públicas, cohorte
  explícita y header de ingress confiable. Errores sin valores de configuración.
- Los cuatro `start` fuerzan producción y validan antes de arrancar Next. Build
  y CI no requieren claves alojadas. Los fixtures declaran APP_ENV=test.
- El piloto productivo bloquea registro abierto y acceso de UUIDs fuera de la
  cohorte; ninguna lista, email o metadata otorga roles. En local/test se conserva
  el flujo ciudadano del prototipo. Cerrar también GoTrue alojado es obligatorio.
- Recuperación RAES Admin, Credenly ciudadano y Credenly Admin con PKCE,
  confirmación POST del enlace, cookies independientes, prueba HMAC de diez
  minutos vinculada a usuario/token, autorización por API propia, validación de
  contraseña y logout global. Se conserva la separación de perfiles y el bloqueo
  SUSPENDIDO/CERRADO. Mensajes sin enumeración ni errores crudos del proveedor.
- Un fallo de logout posterior al cambio se comunica como éxito parcial, sin
  afirmar que los JWT anteriores estén invalidados. Ese comportamiento alojado
  necesita comprobación real con SMTP/Auth y una cuenta autorizada.

### Admisión y observabilidad

- Cuotas atómicas PostgreSQL por producto para todas las réplicas; el freno local
  anterior sigue activo. Login/recuperación utilizan admisión server-to-server,
  sujetos HMAC y límites decididos por la API. Fallos de RPC/configuración cierran
  con 503; excesos con 429, Retry-After y no-store.
- OCR, consulta pública, administración/decisiones y propuestas tienen políticas
  separadas. No se usan Redis, servicios pagos ni confianza implícita en headers
  reenviados. Un origen directo accesible o GoTrue mal configurado sigue siendo
  una barrera externa pendiente, no una garantía del código.
- Eventos estructurados con campos permitidos, request/correlation IDs,
  sanitización, health/readiness de cuatro servicios y herramientas de sondeo y
  backlog. Readiness distingue DB/Auth/RAES; health no simula disponibilidad DB.
- Conectores conservan detectar → presentar → decidir y canonicalWrites:0.
  Presupuesto de lectura, paginación acotada, un retry únicamente ante 429 de
  propuestas, fencing y liberación sin ocultar el fallo causal. No hay retry de
  aprobación ni de escrituras ambiguas.

### Operación, privacidad y recuperación

- Rotación RAES por owner con prepare/revoke transaccional, manteniendo scopes y
  secreto anterior hasta revocación explícita. Candidato exclusivo 0600 fuera de
  Git antes de publicar hash; no se imprime secreto. Bootstrap histórico saneado.
- Retención con dry-run y lotes acotados: texto OCR APROBADA/RECHAZADA y accesos
  compartidos antiguos. No purga identidad, verificaciones estructuradas, vínculos,
  shares, auditoría ni historia académica. No se ejecutó ninguna limpieza real.
- Backup/restore físico WASM ensayado con datos sintéticos locales: todas las
  tablas public, UUIDs Auth, relaciones y guards. Verificador de bundle detecta
  faltantes/corrupción; no certifica cifrado o restore completo de GoTrue/Storage.
- Runbook de secretos, retención, recuperación, cuatro despliegues separados,
  rollback compatible, monitores y conectores. Verificador de aceptación externa
  exige SHA exacto, evidencia reciente y decisiones RPO/RTO; el ejemplo permanece
  bloqueado deliberadamente. OWNER_ATTESTED no significa inspección remota.

### Migraciones nuevas, solo versionadas

| Proyecto | Archivo | Efecto |
| --- | --- | --- |
| RAES | 20261119215836_production_security.sql | Contadores privados, admisión y rotación de secretos. |
| Credenly | 20261119215837_production_security.sql | Contadores privados, admisión y mantenimiento temporal acotado. |

Solo service_role puede ejecutar estas RPC; browser no tiene permisos. No se
modifican migraciones anteriores ni esquemas institucionales. Aplicar únicamente
estas dos migraciones necesitará autorización posterior, sin repair/reset,
repetición del historial, fixtures ni baseline.

### Archivos y commits

La [evidencia JSON](evidence/production-readiness-2026-11-19.json) contiene el
inventario exacto de archivos y comandos/resultados. Las áreas principales son:

- packages/web-core/src: configuración, piloto, admisión, recuperación y logging.
- apps/raes-web y apps/credenly-web: recuperación, guard de registro, configuración,
  sesiones, probes e instrumentation.
- services/raes-api y services/credenly-api: guards, admisión, readiness, logs y
  utilidades operativas; contracts y arquitectura académica conservados.
- packages/connector-core y ambos conectores: presupuesto de lectura, lease,
  reintento acotado y correlación; ningún writer canónico nuevo.
- supabase: dos migraciones y manifest con checksums. scripts/test y tests/frontend:
  regresiones SQL, restore, herramientas, startup y navegador.
- README, docs de arquitectura/desarrollo/Auth/frontend/env/progreso y seis
  plantillas de entorno; documentación específica en docs/production.

| Commit de implementación | Unidad |
| --- | --- |
| 24c99bb | Política productiva, admisión común y migraciones. |
| 458a113 | Recuperación y sesiones aisladas del piloto. |
| 9fa78bc | APIs, observabilidad y operación de conectores. |
| 8eca3af | Rotación, privacidad, backup y restore. |
| 3305367 | Compatibilidad del mensaje público 429 y regresión. |

No se actualizan versiones deliberadamente. Next/eslint-config-next 16.4.6,
React/ReactDOM 19.2.8 y Zod ^4.6.7 se conservan; lockfile solo enlaza dependencias
workspace y el SDK 2.117.2 ya existente. Override minimatch estrecho sin cambios.

## Validación local y límites de la evidencia

Entorno limpio clonado fuera del workspace, Node 24.22.0/pnpm 12.8.1. Solo archivos
versionables, sin .env.local ni secretos remotos. Contratos compilados antes del
typecheck de consumidores; ninguna prueba utiliza las cuatro bases alojadas.

| Gate | Resultado |
| --- | --- |
| Frozen install | PASS |
| Scan de archivos e historia reciente | PASS, cero hallazgos; alcance: 25 commits, no certificado de toda la historia. |
| DDL/archive | PASS: 22 históricos, 5 correctivos, 2 académicos, 2 nuevos. |
| Lint tipado completo | PASS, sin suprimir reglas. |
| Cold RAES Web + typecheck/typegen completo | PASS |
| Tests | 368/368, cero fallos/omitidos. Incluye cuatro esquemas, RLS/grants, composición académica/productiva, backup/restore y utilidades. |
| pnpm audit --prod | PASS, cero vulnerabilidades conocidas. |
| Audit gate completo | PASS, findings vacío. |
| Builds | PASS, cinco workspaces con build, cuatro aplicaciones Next. |
| Browser principal | PASS, 34/34; incluye ocho casos nuevos de recuperación. |
| Browser académico | PASS, 9/9. |
| OCR sintético | PASS, Tesseract local, cero escrituras DB. |
| Operador --verify-completed --local | PASS, replay, conteos iguales, canonicalWrites:0. |
| Postcheck --local | PASS, canonicalRowsUnchanged:true, canonicalWrites:0. |

El primer navegador principal terminó 33 PASS/1 FAIL: se esperaba el mensaje
histórico de RATE_LIMITED y el nuevo adaptador de admisión había cambiado el texto.
Se restauró el contrato sin cambiar umbrales/headers ni debilitar la aserción del
navegador. La nueva regresión comprueba 429/503, Retry-After, no-store y correlación.
La evidencia conserva el resultado inicial y la ejecución posterior por separado.
La excepción braces original no se amplió: venció el 18-11-2026 y no se utiliza
para obtener el PASS actual. No se añadió ninguna excepción de seguridad.

Se compararon las 44 evidencias previas byte por byte: ninguna cambió. Baseline
Poli 47 + UdeA 97 = 144 conservado; FAIL histórico del operador preservado. Las
pruebas locales muestran deduplicación, replay y consulta viva Credenly→RAES sin
persistencia académica. No se certifican conteos remotos nuevos: 4 usuarios Auth,
1 perfil ciudadano y Sergio sin perfil son el estado aprobado que no se tocó.
Valentina/admin no se consultaron ni modificaron durante esta fase.

CI usa el workflow existente sin secretos remotos, con estas mismas suites locales
y ambos navegadores. El estado de la ejecución asociada al head publicado se
comprueba en el PR Draft; un verde no aprueba configuración externa ni despliegue.

## B. Acciones externas finales

La lista exacta está en [acciones externas](../production/README.md#b-acciones-externas-finales):
hosting/dominios/ingress cerrado; cohorte; Auth alojado/SMTP/redirects/sesiones;
correo y recuperación reales; contraseñas filtradas; custodia y rotaciones;
aprobación/aplicación de dos migraciones; retención/RPO/RTO/backup real aislado;
monitores/scheduler/responsables; autorización de despliegue escalonado.

No se deja pendiente implementar otro frontend, endpoint de negocio, migración
institucional o proveedor KYC para este piloto. OCR no acredita autenticidad ni
titularidad; publicar datos reales exige otra decisión y revisión de identidad.
El repositorio queda preparado para revisión del piloto, **no se declara el
sistema listo para producción pública** mientras falte la aceptación externa.
