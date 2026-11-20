# Operación del piloto cerrado

Este runbook prepara acciones futuras. No aplica migraciones, envía correo, rota
claves, elimina datos o despliega automáticamente. Cada acción remota requiere
la autorización y el destino concreto del propietario. Los comandos que consumen
credenciales se ejecutan en el servidor/terminal del operador, no en CI ni browser.

## Despliegue independiente

Instalar desde la raíz del monorepo con Node 24.22.0 y pnpm 12.8.1:
`pnpm install --frozen-lockfile`. Conservar workspaces, paquetes y lockfile; no
copiar una subcarpeta desconectada de sus dependencias. No pasar secretos al build.

| Proceso | Workspace | Build desde raíz | Start desde raíz | Puerto por defecto | Salud / readiness |
| --- | --- | --- | --- | ---: | --- |
| RAES API | services/raes-api | pnpm --filter @raes/api... --if-present build | pnpm --filter @raes/api start | 3001 | /api/v1/health y /api/v1/health/ready |
| RAES Web | apps/raes-web | pnpm --filter @raes/web... --if-present build | pnpm --filter @raes/web start | 3000 | /api/health y /api/health/ready |
| Credenly API | services/credenly-api | pnpm --filter @credenly/api... --if-present build | pnpm --filter @credenly/api start | 3002 | /api/v1/health y /api/v1/health/ready |
| Credenly Web | apps/credenly-web | pnpm --filter @credenly/web... --if-present build | pnpm --filter @credenly/web start | 3003 | /api/health y /api/health/ready |

Start admite PORT y fuerza APP_ENV=production. Prestart valida configuración sin
conectarse a una base. No usa dotenv del monorepo ni mezcla claves de servicios.
Los tests usan `next start` con APP_ENV=test de forma explícita; no es el comando
aprobado de despliegue. TLS, hostname público y acceso al origen pertenecen al
hosting elegido. No usar NODE_TLS_REJECT_UNAUTHORIZED=0.

Orden futuro: preparar variables/ingress → backup autorizado → migraciones nuevas
aprobadas por proyecto → RAES API → RAES Web → Credenly API → Credenly Web → monitores
→ detectores. Las webs llaman su propia API; solo Credenly API llama RAES API.
Verificar cohorte, cookies, no-store, CSP, accesos denegados y entregas de correo
antes de abrir el piloto a sus participantes. Nunca abrirlo públicamente para
comprobar si los guards funcionan.

Rollback: retirar tráfico, detener jobs, conservar logs saneados y desplegar el
artefacto anterior **compatible y validado** con la DB actual. Mantener el cierre
de red/registro y la cohorte. No hacer rollback destructivo de migraciones, no
borrar nuevas tablas, no regenerar baseline ni reconstruir versiones desde fuentes.
Si hay nuevas escrituras confirmadas, recuperar de backup es otro procedimiento
con autorización propia; un rollback de código no las deshace.

## Migraciones

- RAES: 20261119215836_production_security.sql.
- Credenly: 20261119215837_production_security.sql.

Añaden contadores/RPC privadas; RAES prepara/revoca secretos y Credenly mantiene
solo dos clases de datos temporales. No cambian esquemas institucionales, Auth,
usuarios existentes ni historial académico. Se reconstruyen en WASM detrás del
historial archivado, hardening y revisión académica. No se ejecutan al iniciar.
Si falta la RPC de admisión en producción, la API responde 503: no omitir el gate.
Las bases actuales ya contienen revisión académica: no repetir historial, repair,
reset, fixtures ni baseline al aplicar estos dos cambios futuros.

## Secretos y rotación

| Material | Custodia / generación | Procedimiento |
| --- | --- | --- |
| Service-role / secret key Supabase RAES | Solo RAES API/operadores; generación oficial del proyecto | Registrar consumidores, preparar sustituto por mecanismo soportado, actualizar/reiniciar, verificar, revocar anterior. |
| Service-role / secret key Credenly | Solo Credenly API/operadores | Igual, sin introducir la clave RAES en el proceso Credenly. |
| Claves institucionales | Solo conector correspondiente; el código solo lee | La institución decide permisos y rotación. No alterar sus políticas desde este runbook. |
| Publishable/anon | Servidor web de su proyecto; material público de Auth | No tratarla como autorización administrativa. Revisar restricciones del proyecto y nunca sustituirla por service_role. |
| Firmas/JWT/Auth | Gestión oficial Supabase; no exportar claves privadas al repo | Determinar si son legacy JWT, claves modernas o signing keys. No rotar a ciegas: afecta sesiones y consumidores. |
| Integración Poli/UdeA y cliente Credenly→RAES | CSPRNG backend; RAES conserva hash/prefijo | Rotación transaccional descrita abajo; client_id, scopes y ownership se conservan. |
| ADMISSION_SECRET por producto | CSPRNG ≥32 bytes; solo su web y API | Actualizar ambas partes coordinadamente. El cambio invalida pruebas de recuperación pendientes y reinicia sujetos HMAC; programar la ventana y verificar 401/429/503. |
| CI/despliegue | CI canónico no necesita secretos remotos | Credenciales de hosting/registro de artefactos solo si la plataforma elegida las exige; mínimo alcance y custodia externa. |
| Compartición | CSPRNG; Credenly conserva hash | Un enlace perdido se reemplaza/revoca por el flujo ciudadano; no puede recuperarse desde DB. |

No mostrar valores en chat/logs. Usar gestor del sistema o archivo cifrado/fuente
protegida fuera de Git, permisos restringidos. No crear archivos de secretos dentro
del repo aunque estén ignorados. La utilidad nueva usa creación exclusiva 0600,
no sigue symlinks ni sobrescribe. El bootstrap histórico de institución tampoco
imprime bearer/secret y exige `--secret-output=/ruta/externa`.

### Integraciones y cliente consumidor

Desde `services/raes-api`, con su entorno server-only autorizado:

```text
pnpm exec tsx scripts/manage-secret.ts --kind=INTEGRATION --owner=<UUID> --action=PREPARE
pnpm exec tsx scripts/manage-secret.ts --kind=INTEGRATION --owner=<UUID> --action=PREPARE --output=/ruta/segura/candidato.json --execute --approval=<referencia>
```

El primer comando solo muestra el plan, cero llamadas remotas. El segundo escribe
el candidato protegido **antes** de enviar su hash a la RPC; no revoca el anterior.
Para Credenly→RAES usar kind=CLIENT. La salida contiene el UUID del nuevo secreto,
nunca su valor. Si hay respuesta ambigua, conservar candidato y comprobar la fila
por prefijo/hash con tooling autorizado antes de reintentar; no crear otro a ciegas.

Actualizar solo el consumidor correspondiente, probar whoami/scopes y una lectura
o detección idempotente autorizada, y revocar el UUID exacto anterior:

```text
pnpm exec tsx scripts/manage-secret.ts --kind=INTEGRATION --owner=<UUID> --action=REVOKE --secret-id=<UUID-anterior> --execute --approval=<referencia>
```

Comprobar que la clave vieja ya no autentica. Revocar el último secreto corta el
acceso deliberadamente. Antes de revocar el anterior, rollback consiste en volver
al anterior y revocar el candidato; después no se resucita una clave comprometida:
preparar otra. El hash no permite recuperar el secreto. La RPC registra auditoría
sin material secreto y valida que el UUID a revocar pertenezca al owner indicado.

## Retención y privacidad

Esta clasificación responde a las invariantes del proyecto, no fija plazos legales.
El propietario debe aprobar finalidad, plazos, responsables y almacenamiento.

| Datos | Clase / tratamiento |
| --- | --- |
| Credenciales, versiones, eventos, operaciones e identidad/fuentes RAES | Historial permanente del prototipo; no purgar ni reescribir. |
| Cortes y 144 huellas de baseline | Evidencia inmutable; no regenerar ni borrar. |
| Propuestas/decisiones académicas y su auditoría | Historial necesario para explicar el estado; contiene datos personales propuestos. No se añade borrado automático. |
| Auditoría de consultas RAES | Acciones/actor/endpoint plantilla/resultado; sin tokens/documentos/cuerpos. Plazo sujeto a política aprobada. |
| Auditoría Credenly Admin | UUID, operación y resultado mínimos; conservar trazabilidad, sin purga automática. |
| OCR imagen | Temporal en memoria; sin almacenamiento de imagen por este flujo. |
| OCR texto_extraido | Persistido en DB; purgable tras resolución y plazo aprobado, no mientras PENDIENTE/PROCESADA/REVISION. |
| Verificación estructurada y vínculo | Conservados por finalidad e integridad/FK; no se eliminan con la limpieza de texto. |
| Comparticiones | Token en claro solo al crear; hash y metadatos persistidos, estados históricos conservados. |
| Accesos compartidos | Purgables según política; IP pseudonimizada sigue siendo correlacionable. |
| Contadores de abuso | Estado temporal HMAC; housekeeping acotado de ventanas inactivas de más de una hora. |
| Logs | Eventos técnicos saneados; fijar retención en hosting y excluir tokens/PII. |
| Evidencias Git | Metadatos/huellas de pruebas; no dumps, contraseñas ni sesiones. FAIL histórico se conserva. |

Desde `services/credenly-api`, dry-run de la política elegida:

```text
pnpm exec tsx scripts/maintain-privacy.ts --kind=RESOLVED_OCR_TEXT --days=<plazo-aprobado> --limit=500
```

Solo `--execute --approval=<referencia>` habilita escritura. SHARE_ACCESSES elimina
accesos viejos; RESOLVED_OCR_TEXT borra únicamente texto de APROBADA/RECHAZADA.
Máximo 1000 filas por llamada, selección bloqueada con SKIP LOCKED; repetir por
lotes con supervisión. No elimina usuarios, perfiles, verificaciones, vínculos,
shares, auditoría ni académicos. Guardar recibos saneados. La programación del job
y los plazos se configuran después de aprobación; no se ejecutó sobre datos reales.

## Backup y recuperación

1. Aprobar RPO/RTO y ventana. Inventariar por separado RAES y Credenly: versiones
   Git/DB, configuración Auth/URLs/plantillas, roles, extensiones y referencias a
   secretos custodiados externamente. Las instituciones conservan sus políticas.
2. Usar tooling oficial compatible con la versión real del servidor, descubrir
   flags con `--help`, y exportar esquema/datos/roles según soporte. No poner
   contraseñas en URL/argumentos/logs. Cifrar backups fuera del repo y limitar acceso.
3. Verificar explícitamente Auth y sus UUIDs/identidades/sesiones. Un dump de public
   no recupera Auth. Un dump SQL tampoco configura SMTP, redirects, signing keys,
   políticas de hosting, objetos Storage ni secretos externos. Inventariar/exportar
   esos componentes según uso; no asumir que el plan incluye PITR o backups útiles.
4. Guardar un manifiesto con cuatro clases de archivo: database, auth,
   configuration y external-secret-references; cada una con path relativo y SHA-256.
   La última contiene referencias de custodia, no valores. Verificar con
   `pnpm backup:verify /ruta/bundle/manifest.json`. Detecta faltantes/corrupción;
   no certifica cifrado, origen ni restaurabilidad por sí solo.
5. Restaurar primero en un destino vacío **aislado**: plataforma/roles/extensiones,
   Auth manteniendo UUIDs y después tablas/relaciones en orden compatible. Recuperar
   RAES coherente (identidad, fuentes, credenciales, versiones/eventos/operaciones,
   baseline/revisión) y luego Credenly con los mismos UUIDs/vínculos/shares. No copiar
   académicos a Credenly. No aplicar un bootstrap encima de bases actuales.
6. Comparar catálogos, conteos/huellas, constraints, RLS/grants/RPC, exclusión de
   perfiles, guards y estado de comparticiones. Revisar Auth/config externa sin
   imprimir hashes de contraseñas. Probar login/recuperación con una cuenta sintética
   autorizada, lecturas vivas y denegaciones antes de cambiar tráfico.
7. Medir tiempos y pérdida máxima de datos frente a objetivos; registrar RPO/RTO
   observados y discrepancias. Autorizar reanudación y luego detectores. Ante fallo,
   mantener tráfico detenido y conservar evidencia; no forzar FKs ni recrear UUIDs.

El ensayo automatizado `scripts/test/restore-rehearsal.test.mjs` reconstruye, siembra
solo datos sintéticos locales, crea un backup físico WASM y lo restaura en otra
instancia. Compara todas las tablas public y los UUIDs Auth de prueba; incluye
shares/accesos, vínculo, auditoría e historial. Auth es un sustrato mínimo local,
no GoTrue completo. El ensayo real de plataforma/datos necesita una copia y destino
autorizados: permanece como acción externa, sin ejecutarse sobre proyectos actuales.

## Monitorización y alertas

`node scripts/monitor-service.mjs https://<api>` comprueba health y ready; añadir
`web` para los paths de una web. No envía credenciales ni refleja cuerpos de error.
Readiness caída no se convierte en healthy por tener liveness disponible.

Para backlog, desde RAES API: `pnpm exec tsx scripts/monitor-queue.ts
--max-pending=<umbral> --max-age-minutes=<umbral>`. Solo lee total exacto y fecha más
antigua; no obtiene payloads, nombres o documentos. Los umbrales son decisiones del
operador, no estadísticas inventadas ni ceros cuando falla la consulta.

| Alerta | Señal preparada | Acción operacional |
| --- | --- | --- |
| API/web caída | health no disponible | Reinicio supervisado y revisar proceso/hosting. |
| DB Supabase no disponible | ready 503 y componente database | Revisar proveedor/conexión, fallar cerrado; no resetear DB. |
| Auth no disponible | ready auth down | Revisar proyecto/Auth, evitar reintentos masivos. |
| RAES inaccesible desde Credenly | ready raes down | Revisar ruta/credencial consumidora; no servir snapshot. |
| Conector falla/no completa | CONNECTOR_FAILED / CONNECTOR_RELEASE_FAILED y ausencia de COMPLETED | Revisar exit/status y lease; no aprobar automáticamente. |
| Propuestas acumuladas | monitor-queue: total/edad | Asignar revisión humana y evaluar capacidad. |
| Decisiones fallidas | ACADEMIC_DECISION_FAILED con status/requestId | Revisar permiso/conflicto/estado; preservar historial. |
| Cuota anormal | RATE_LIMITED / LIMIT_UNAVAILABLE | Revisar abuso, proxy, DB y capacidad; no subir límites a ciegas. |

Logs estructurados aceptan eventos/campos conocidos; no mensajes, stacks, headers,
URLs con tokens, IPs ni emails. Las respuestas incorporan X-Request-Id y los
conectores mantienen su correlación al llamar RAES. El hosting aún debe recolectar
stdout, redactar URLs propias y configurar entrega/confirmación de alertas, SLO y
retención. No se eligió ni contrató proveedor.

## Poli y UdeA

Ejecutar `APP_ENV=production pnpm --filter @raes/connector-poli detect` o
`APP_ENV=production pnpm --filter @raes/connector-udea detect`
en un proceso con su entorno propio. Como punto de partida operativo para este
piloto pequeño, programar cada cinco minutos, con arranques desfasados y sin jobs
solapados; el propietario debe comprobar duración/cuotas en la infraestructura
que elija. No se añadió un cron remoto ni un servicio de pago.

La exclusión real entre réplicas la impone el lease PostgreSQL por institución,
vence a los 120 segundos y se renueva con cada submit. El UUID de fencing impide
que una ejecución antigua publique/libere otra posterior. Leer la fuente tiene
un presupuesto total de 90 segundos y 30 por petición, 1000 filas por página y
100000 por tabla; una fuente excesiva/inconsistente falla antes de proponer. No se
adoptan datos incompletos. No se regenera baseline al reintentar.

Solo una respuesta 429 de POST propuestas con Retry-After entre 1 y 60 segundos
admite un reintento acotado del mismo contenido. No hay reintentos implícitos de
aprobación, mutaciones legacy ni operaciones con resultado de red ambiguo. Ante
fallo parcial, la próxima ejecución vuelve a observar todo: deduplicación conserva
propuestas previas sin escrituras canónicas. No reiniciar en bucle; alertar, esperar
la cuota/lease y aplicar backoff del scheduler. Un error al liberar el lease no
oculta el error original; se registra aparte. El resumen exitoso se emite después
de la liberación y conserva canonicalWrites:0.

Ante pérdida de credenciales, usar rotación supervisada. Ante cambio de origen,
no cambiar namespace, identidad o baseline sin procedimiento revisado. Si una fuente
real requiere otros volúmenes/garantías, necesita evaluación fuera del piloto
sintético cerrado aprobado. Las instituciones no reciben tablas ni conocimiento
interno de RAES y no se modificaron sus bases ni políticas.
