# Revisión de APIs y concurrencia — 2026-10-19

Inventario de los 34 archivos route.ts reales (20 RAES, 14 Credenly). No se crearon
endpoints administrativos de auditoría, scopes o listado de integraciones.
`/admin/me` existente conserva el comportamiento y roles aprobados.

Todas las rutas /api llevan no-store y cabeceras de seguridad, incluidas respuestas
401/403/429/5xx. JSON se lee por stream <=64 KiB antes de parsear; los schemas Zod
proyectan campos permitidos y rechazan tamaños/estados inválidos. Multipart <=8 MiB
+64 KiB; archivo OCR <=8 MiB JPEG/PNG/WebP. No se confía en Content-Length como único
control. GET no parsea bodies. No se devuelven errores SQL, claves o payloads crudos.

## RAES

| Ruta /api/v1 | Actor / autorización real | Entrada y aislamiento | Mutación, auditoría, idempotencia |
| --- | --- | --- | --- |
| GET /health | Público | Sin body, estado de proceso | Ninguna |
| GET /health/ready | Público | Config/consulta mínima DB; sin secretos | Ninguna |
| GET /auth/whoami | Integración activa + institución activa + secreto vigente/hash | Bearer institucional; identidad del actor autenticado | Actualiza uso; no recibe tenant por body |
| GET /auth/client-whoami | Cliente API activo + secreto vigente/hash | Bearer consumidor; identidad/scopes mínimos | Uso y auditoría CLIENTE_API, fail-closed |
| GET /admin/me | JWT RAES + perfil ACTIVO; SUPERADMIN/ADMIN/AUDITOR | Cinco campos mínimos por UUID; sin email/metadata | Ninguna; no amplía roles por defecto |
| GET /admin/institutions | JWT RAES; SUPERADMIN/ADMIN/AUDITOR | Listado administrativo; <=1000 y total exacto | Lectura; no secreto |
| POST /admin/institutions | JWT RAES; SUPERADMIN/ADMIN | Schema de alta, NIT/SNIES únicos | Alta + auditoría; no replay de POST |
| POST /admin/institutions/[institutionId]/integrations | JWT RAES; SUPERADMIN/ADMIN | UUID + schema/scopes existentes y su institución | RPC atómica de integración/secret hash/scopes; secreto una vez; auditoría posterior |
| GET /admin/api-clients | JWT RAES; SUPERADMIN/ADMIN/AUDITOR | Sin hashes/texto secreto; <=1000 y total exacto | Lectura |
| POST /admin/api-clients | JWT RAES; SUPERADMIN/ADMIN | Tipo de cliente y scopes admitidos | RPC cliente/secret hash/scopes; secreto una vez; auditoría posterior |
| PUT /sync/institution | Integración + institution:sync | Institución derivada del actor, NIT debe coincidir | Actualiza metadatos de su institución |
| PUT /sync/campuses | Integración + institution:sync | institutionId del actor, origen acotado | UNIQUE institución/origen; upsert |
| PUT /sync/programs | Integración + institution:sync | institutionId del actor | UNIQUE institución/origen; upsert |
| PUT /sync/program-campuses | Integración + institution:sync | Resuelve ambos códigos dentro del tenant | UNIQUE programa/sede; upsert |
| PUT /sync/persons | Integración + persons:sync | Identidad documental normalizada; fuente dentro de institución | Maestra UNIQUE documental; fuente UNIQUE institución/origen; no reasigna identidad |
| POST /credentials | Integración + credentials:create | Referencias resueltas dentro de institución | Headers Request-Id / Idempotency-Key + hash; RPC operación/credencial/versión/evento atómica |
| POST /credentials/corrections | Integración + credentials:correct | Código pertenece al tenant; contenido/motivo validado | RPC versiona, no edita versión anterior; idem+hash y locks DB |
| POST /credentials/revocations | Integración + credentials:revoke | Código del tenant, motivo/fecha | RPC terminal, conserva historia; idem+hash y locks DB |
| POST /credentials/annulments | Integración + credentials:annul | Código del tenant, motivo/fecha | RPC terminal, conserva historia; idem+hash y locks DB |
| GET /credentials/source/[code] | Integración + credentials:read | Filtro institución+origen; otra institución recibe 404 | Lectura de ownership/contenido, sin cambiar legacy |
| POST /persons/resolve | Cliente API + persons:resolve | Tipo+número normalizados; consumidor autorizado multiinstitución | Solo resuelve; auditoría mínima CLIENTE_API |
| GET /persons/[personId]/credentials | Cliente API + credentials:read | UUID válido; no es un JWT ciudadano ni acceso directo DB | Lectura viva multiinstitución + auditoría; versiones actuales en lotes de 50 |

401: secreto/JWT ausente, inválido, expirado/revocado o actor inactivo.
403: actor válido sin rol/scope requerido. Las referencias institucionales ajenas
no se resuelven y no permiten asignar programas/personas de otro tenant.
Los secretos de servicio se generan aleatoriamente, se verifican mediante hash y
comparación segura; sin secreto original en listados. Service-role permanece en
su servidor de origen. No se confía en email ni user_metadata para autorizar.

## Credenly

| Ruta /api/v1 | Actor / autorización real | Entrada / salida | Mutación, auditoría, idempotencia |
| --- | --- | --- | --- |
| GET /health | Público | Proceso | Ninguna |
| GET /health/ready | Público | Dependencias sin secretos | Ninguna |
| GET /auth/me | JWT Credenly ciudadano; cualquier perfil admin lo excluye | UUID mínimo | Ninguna |
| GET /profile | Ciudadano | Su propio UUID, campos mínimos | Lectura |
| PUT /profile | Ciudadano | Solo nombres/apellidos; estado no asignable | Upsert propio; DB impide solapamiento admin |
| GET /identity-verifications | Ciudadano | Última verificación propia, sin texto OCR completo | Lectura acotada a 1 |
| POST /identity-verifications | Ciudadano | Multipart acotado, MIME/tamaño, OCR servidor | Crea intento; estados reales; imagen solo RAM, texto extraído sí persiste; sin replay |
| GET /raes/link | Ciudadano | Referencia propia, sin académicos | Lectura |
| POST /raes/link | Ciudadano | Verificación APROBADA de su UUID, resolución RAES por API | RPC vinculación; UNIQUE usuario/persona/verificación; no copia académicos |
| GET /credentials | Ciudadano con vínculo VERIFICADA | RAES API viva; DTO validado y proyección explícita | source RAES, persistedByCredenly false; cero escritura académica |
| GET /shares | Ciudadano | Solo su UUID, campos proyectados, sin token/hash; listado completo acotado | Lectura |
| POST /shares | Ciudadano vinculado, credencial propia comprobada en RAES | Campos enum y expiración 1–720 horas | Token CSPRNG256 una vez, hash persistente; dos solicitudes son dos enlaces distintos, no hay replay automático |
| DELETE /shares/[shareId] | Ciudadano propietario | UUID + filtro propietario | UPDATE condicional revoked_at IS NULL; doble revoke produce conflicto, no otra transición |
| GET /public/shares/[token] | Token aleatorio válido, sin login | Hash lookup; 404/410; campos autorizados y estado actual siempre visibles | RAES vivo; acceso auditado antes de entregar; IP HMAC, sin snapshots |
| GET /admin/me | JWT Credenly + ACTIVO/ADMIN_CREDENLY por UUID | Perfil administrativo mínimo | Auditoría de lectura; fail-closed |
| GET /admin/overview | Mismo guard admin | Conteos/estados, incidentes mínimos; no PII/OCR/academia | Auditoría; conteos no son snapshot transaccional |
| GET /admin/users | Mismo guard admin | Página entera 1–9999, 20 filas mínimas; sin email/metadata/hashes | Auditoría |
| GET /admin/health | Mismo guard admin | Dependencias por API, nunca RAES DB | Auditoría; HTTP wrapper 200 puede proyectar readiness 503 |

Un ciudadano no puede /admin. Una cuenta administrativa, incluso inactiva, no
puede flujo ciudadano. DB ahora impide ambos tipos de perfil para el mismo UUID.
El token de share no se guarda en browser permanentemente ni se recupera por
listado. El resultado público solo proyecta campos elegidos; revocación/expiración
preceden consulta académica. Fallo de auditoría de acceso no entrega credenciales.

## Concurrencia / límites / gaps explícitos

- RPC académicas usan advisory_xact_lock por integración/idempotency y por
  institución/código; corrección/terminal además bloquean la credencial. UNIQUE
  operación, código institucional y número de versión. Historial protegido por
  triggers inmutables. Replay con otro hash falla. El ensayo SQL real de corrección,
  revocación/anulación pasó con rollback y preservación de versiones anteriores.
- Persona-fuente ahora INSERT ON CONFLICT DO NOTHING y verifica el ganador; carrera
  de documentos diferentes produce 409 sin cambiar persona_id. Puede quedar una
  maestra sin fuente porque ese flujo multisentencia aún no es una RPC atómica.
- Vinculación: UNIQUE usuario, persona RAES y verificación impiden duplicados. La
  política de revinculación de una cuenta ya vinculada debe permanecer controlada;
  no se introdujo transferencia de identidad ni un bypass de OCR.
- Exclusión de perfiles usa lock PostgreSQL por UUID en ambos triggers y rechaza
  niveles de aislamiento distintos de READ COMMITTED. No se simula concurrencia
  real entre conexiones con PGlite; los tests Node de carrera usan barrera controlada
  y el UNIQUE/ON CONFLICT reales son la autoridad de protección.
- Aprovisionamiento tiene transacción para actor/secreto/scopes pero la auditoría
  posterior y la entrega de texto secreto no son atómicas con la respuesta HTTP.
  No reintentar un alta automáticamente tras timeout: comprobar antes el listado.
  No hay recuperación de secreto ni endpoint de rotación; ver operations.md.
- Listados admin/shares leen <=1000 y contrastan count=exact; si se truncaron,
  devuelven 503 LIST_LIMIT_EXCEEDED, sin presentar una página como el universo.
  Credenciales soportan >1000, límite de trabajo 10000, total estable y rechazo de
  duplicados; no responden parcialmente. El cliente Credenly acota JSON upstream
  a 2 MiB. Una paginación pública/UI de estos listados es una ampliación futura;
  no se añadió silenciosamente una ruta o RPC. Counts exactos también tienen costo.
- Admisión local por proceso y OCR con capacidad/plazo. No hay control distribuido,
  CAPTCHA ni protección de borde aprobada. Supabase limita sus endpoints Auth;
  esos límites no protegen las rutas propias. Internet público sigue bloqueado
  hasta resolver el modelo de abuso/infraestructura y autenticidad de identidad.
- Antes de crear un intento OCR se comprueban firma y estructura de cabeceras PNG,
  JPEG SOF y WebP VP8/VP8L/VP8X; <=16 megapíxeles, <=8192 por lado, chunks/segmentos
  acotados, sin animación APNG/WebP ni discrepancias canvas/frame. No se decodifican
  píxeles en este paso y no se añaden dependencias nativas. Es preflight de metadatos,
  no un validador completo de codecs ni una prueba de autenticidad. Se conserva
  worker único/plazo como segunda barrera. Referencias: especificación PNG-3 W3C,
  JPEG ITU T.81 y WebP RIFF Google.
