# Operación y recuperación del prototipo

Procedimiento pre-deploy del 2026-10-19. No habilita un despliegue ni constituye
un restore certificado. Las operaciones sobre datos reales, rotaciones, purgas
y recuperación de cuentas requieren autorización del propietario para ese evento.

## Recuperación

1. Detener escrituras de conectores y altas; mantener evidencia de incidente sin
   cuerpos, tokens, documentos o contraseñas. Registrar hora, proyecto y versión
   Git desplegada. No borrar bases ni restablecer UUIDs para resolver un acceso.
2. Inventariar por separado los cuatro proyectos y su historial de migraciones.
   `supabase/bootstrap/manifest.json` recupera el DDL original y las correcciones
   aprobadas. El ensayo PostgreSQL/WASM valida el esquema y permisos sin datos;
   todavía falta un ensayo completo de plataforma Supabase y restore de datos.
3. Para backups autorizados usar herramientas oficiales de Supabase/PostgreSQL
   compatibles con la versión del servidor (remoto observado: 17.11). Descubrir
   flags con `supabase db dump --help`; `--linked` exige vinculación al proyecto
   correcto. Exportar schema y data por separado, fuera del repo, en almacenamiento
   cifrado con acceso restringido. No usar URLs con contraseña en argumentos ni
   logs. Incluir roles/grants y verificar qué esquemas incluye la herramienta.
4. Un dump de public no recupera Auth completo, Storage ni configuración del
   proveedor. Registrar por separado configuración Auth no secreta, URLs permitidas,
   plantillas y referencias a archivos. Un backup con hashes/PII continúa siendo
   sensible. Verificar antes de asumir que el plan contratado incluye backups/PITR;
   no habilitar servicios pagos para esta fase.
5. Restaurar primero en un entorno aislado vacío. No reproducir todo el historial
   sobre una base existente ni mezclar los timestamps antiguos de Git con los de
   remoto. Fallar al primer error. Validar constraints, RLS/grants, RPC/search_path,
   usuarios Auth y sus UUIDs, referencias RAES y separación entre productos.
6. RAES: preservar credenciales, versiones, eventos, operaciones e identidad/fuentes
   como una unidad consistente. No regenerar historial desde el estado vigente de
   una institución ni adoptar credenciales legacy automáticamente.
7. Credenly: preservar Auth UUIDs, perfiles, verificaciones, vinculación, comparticiones,
   accesos y auditoría. No recuperar académicos copiándolos a Credenly; consultar
   RAES vivo. Restaurar relaciones antes de habilitar tráfico. Comparar conteos y
   huellas de identificadores/metadatos, sin imprimir PII o hashes de secretos.
8. Probar login sintético, permisos negativos, consulta viva, revocación/expiración
   pública y una sincronización controlada/idempotente antes de reanudar. El
   propietario autoriza el cambio de tráfico. Documentar RTO/RPO medidos: actualmente
   no existen objetivos medidos ni una recuperación de datos ensayada.

## Pérdida o exposición de secretos

| Secreto | Generación y almacenamiento | Respuesta / impacto |
| --- | --- | --- |
| Supabase service_role / secret key | Dashboard oficial; solo servidor/gestor local protegido | Rotar/revocar por mecanismos oficiales del proyecto, actualizar únicamente consumidores autorizados y reiniciar. Una legacy service_role JWT puede depender de la clave de firma: no rotarla a ciegas porque afecta tokens/anon y sesiones. Confirmar tipo de clave antes. |
| Integración institucional RAES | Aleatorio CSPRNG de backend; hash SHA-256 + prefijo en RAES | El texto original no se recupera. Preparar nuevo secreto para la misma integración, solapamiento controlado y revocar anterior; conservar institución, ownership, namespace y ledger. No existe aún endpoint de rotación. La operación requiere tooling administrativo revisado; no editar hashes inventados ni crear otra institución. |
| Cliente Credenly → RAES | Aleatorio de backend; hash/prefijo en RAES, texto solo Credenly API | Mismo procedimiento; comprobar scopes persons:resolve / credentials:read. Revocar el anterior después de validar nuevo; emergencia puede causar indisponibilidad deliberada. No cambiar identidades o vínculos para reparar una credencial de servicio. |
| Contraseña administrativa | Elegida por operador, entrada oculta, mínimo 12 | Usar tooling admin:reset-password de RAES o recuperación oficial Auth para Credenly. Conservar UUID/rol y verificar propiedad; revocar sesiones en un incidente. Ningún correo/metadata concede rol. |
| Contraseña ciudadana | Supabase Auth; mínimo remoto 12 aprobado | Recuperación soportada o citizen:reset-password de operador con autorización. No crear usuario nuevo ni transferir relaciones por email. |
| Tokens de compartición | CSPRNG 256 bits, hash SHA-256 en Credenly | Solo existen al crear. Si se pierde, crear otro y revocar anterior. La rotación de service_role no recupera/revoca estos enlaces automáticamente. |
| Clave de pseudonimización de IP | Actualmente derivada de service_role Credenly | Su rotación cambia la correlación de hashes futuros. No se afirma anonimización irreversible ni continuidad histórica de IP. No se introduce un secreto nuevo sin decisión. |
| PAT CLI / token GitHub | Keychain / autenticación oficial del operador | Revocar en proveedor y reautenticar; no copiar a .env ni CI. Revisar acciones efectuadas durante exposición. |

Nunca adjuntar secretos, dumps, storageState, HAR, capturas privadas o sesiones a
Git/PR. Probar una rotación con material sintético y confirmar que el secreto viejo
ya no autentica; no se realizó una rotación de secretos reales en esta auditoría.
Los endpoints de alta muestran secretos una vez. Si hay timeout, consultar antes
de repetir: no existe recuperación del texto ni idempotencia de alta administrativa.

## Retención propuesta, pendiente de aprobación

No se ejecutó ninguna purga. Propuesta para el piloto controlado:

| Datos | Propuesta | Condición |
| --- | --- | --- |
| Versiones/eventos/operaciones RAES | Conservar todo el historial del piloto | No purgar ni editar versiones para ahorrar espacio |
| Auditoría RAES / Credenly Admin | 180 días, exportación cifrada antes de revisión | Aprobar finalidad, responsables y necesidad de conservación mayor |
| Accesos de compartición | 90 días | IP pseudonimizada sigue siendo dato potencialmente correlacionable |
| Verificaciones estructuradas / vinculación | Mientras exista la finalidad y cuenta activa | Revisar dependencias históricas y restricciones FK antes de eliminar |
| texto_extraido OCR | Proponer eliminar tras 30 días de resolución | **Hoy persiste en DB**; no afirmar que solo existe en memoria. Revisar necesidad y evidencia antes de cambio/purga |
| Imágenes OCR | Solo memoria durante procesamiento | No se almacena la imagen ni una ruta persistente; no equivale a borrado físico certificado de RAM |
| Logs operativos | 14 días como máximo propuesto | Sin URLs con tokens, querystrings de callback, cuerpos, PII ni credenciales |
| Backups | Política cifrada con ventanas asociadas al RPO acordado | No existe todavía calendario ni restore de datos medido |

## Observabilidad segura

- /health indica proceso; /health/ready dependencias. Credenly Admin /admin/health
  separa database/Auth/RAES. Configured de Auth no prueba un login real.
- Auditoría RAES, auditoría mínima de lecturas admin Credenly, accesos de compartición
  y resúmenes de conectores. No hay alertas centralizadas ni métricas de latencia/SLO.
- Los errores públicos son genéricos; logs propios omiten payloads y errores crudos
  de SDK. Next no registra rutas entrantes ni invocaciones de acciones en desarrollo.
  En un futuro proxy/hosting, redactar /verify/:token, /public/shares/:token y
  parámetros de Auth callback; no registrar Authorization/Cookie. Esta aplicación
  no puede garantizar la política de un proxy que aún no se ha seleccionado.
- Los límites locales y la capacidad OCR se reinician con el proceso y no se
  comparten entre réplicas. Antes de Internet público decidir un control global
  gratuito/autohospedado o de infraestructura ya disponible y un modelo de proxy
  confiable. No se añadió Redis/SaaS ni confianza arbitraria en x-forwarded-for.

## Contraseñas e identidad

Auth RAES y Credenly: mínimo remoto 12; signup público RAES deshabilitado por
aprobación. No se cambiaron contraseñas existentes. Leaked-password protection
permanece deshabilitada: [Supabase la ofrece desde Pro](https://supabase.com/docs/guides/auth/password-security).
Sin costo, se pueden usar contraseñas largas aleatorias para operadores, una lista
local de contraseñas comunes y límites Auth existentes; eso **no equivale** a HIBP.
El servicio gratuito Pwned Passwords con k-anonymity sería otro proveedor/flujo y
necesita decisión e integración completa (incluidos accesos directos a Auth).
No se envían contraseñas ni hashes a terceros en esta fase.

OCR valida procesamiento documental, no titularidad/autenticidad legal ni KYC.
Es aceptable únicamente como limitación explícita del demo académico controlado;
**BLOCKER para una oferta pública que afirme identidad real**. No se sustituye por
un proveedor nuevo ni se reasignan identidades por correo.

El modelo de idioma de Tesseract puede descargarse en el primer arranque y cachear
`spa.traineddata` localmente, ignorado por Git. Ese archivo es un modelo, no una
imagen/documento ciudadano. Antes de un despliegue decidir precarga y verificación
del modelo, conectividad de arranque y límites del proceso. La prueba local
`pnpm --filter @credenly/api exec tsx scripts/verify-local-ocr.ts` usa solo píxeles
sintéticos y no requiere Auth/DB; no forma parte de CI porque su primer arranque
puede depender de descargar el modelo.
