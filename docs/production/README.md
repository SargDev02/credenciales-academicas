# Preparación del piloto cerrado RAES y Credenly

Base: main `d48c772485d56e4d06696c4ce3b67f5a3761332d`, PR #16 y #17 integrados.
Trabajo en `chore/production-readiness`. El propietario decidió el 19 de noviembre
de 2026 que el primer despliegue será un **piloto cerrado con datos sintéticos**.
No se autoriza todavía despliegue, cambio remoto, rotación ni limpieza real.

El repositorio prepara ese alcance. No habilita una oferta pública con datos
académicos reales. La finalización técnica local y la aceptación de la configuración
alojada son verificaciones distintas.

## Auditoría y clasificación

| Área | Clasificación inicial | Resultado en esta rama / acción externa |
| --- | --- | --- |
| Revisión académica, baseline, versiones y auditoría | YA RESUELTO | Se conservan detección → propuesta → decisión transaccional; canonicalWrites:0. |
| Roles y aislamiento | YA RESUELTO | ADMIN/SUPERADMIN deciden, AUDITOR consulta; ciudadano/admin excluidos por UUID. |
| CSP, no-store, OCR y upstream | YA RESUELTO | Se conservan límites, etiquetas OCR completas, proyección/validación y headers. |
| Configuración de producción | RESOLUBLE EN CÓDIGO AHORA | Validación estricta de seis procesos, URLs HTTPS sin localhost, secretos separados, cohorte, proxy declarado y prestart. |
| Recuperación de contraseña | RESOLUBLE EN CÓDIGO AHORA | Solicitud, PKCE, cookies separadas, confirmación POST, prueba firmada, actualización autorizada y logout global. |
| Límites entre réplicas | RESOLUBLE EN CÓDIGO AHORA | RPC atómica en cada DB de producto, además del límite local existente. Sin Redis/SaaS. |
| Logs y diagnóstico | RESOLUBLE EN CÓDIGO AHORA | Registros estructurados, request IDs, errores saneados, readiness y herramientas de monitorización. |
| Rotación de secretos RAES | RESOLUBLE EN CÓDIGO AHORA | Preparar/revocar con RPC transaccional y entrega 0600 fuera del repo. Sin rotación ejecutada. |
| Retención temporal | RESOLUBLE EN CÓDIGO AHORA | Herramienta acotada con dry-run; solo texto OCR resuelto y accesos compartidos. Sin purgas ejecutadas. |
| Reconstrucción y ensayo de restore | RESOLUBLE EN CÓDIGO AHORA | DDL de cuatro bases; backup/restore físico WASM de datos sintéticos, UUIDs y relaciones; verificador de bundles. |
| Auth alojado, SMTP y sesiones | REQUIERE CONFIGURACIÓN REMOTA | Verificar y configurar ambos proyectos; no se presupone su estado actual. |
| Contraseñas filtradas | REQUIERE DECISIÓN DEL PROPIETARIO | Elegir protección disponible sin contratar planes. Longitud mínima no equivale a detección de filtraciones. |
| Cohorte y retención | REQUIERE DECISIÓN DEL PROPIETARIO | Aprobar UUIDs/correos sintéticos, plazos y finalidad. No incluir ni restaurar Sergio. |
| RPO/RTO | REQUIERE DECISIÓN DEL PROPIETARIO | Fijar objetivos y medir restore con una copia real autorizada en un destino aislado. |
| Hosting, dominios, ingress y alertas | REQUIERE INFRAESTRUCTURA EXTERNA | Elegir plataforma, cerrar acceso, instalar TLS y conectar monitorización. No se contrataron servicios. |
| Migraciones nuevas | REQUIERE CONFIGURACIÓN REMOTA | Aplicarlas únicamente después de revisión y autorización separada; nunca como parte de build/start. |

## A. Implementado y listo en el repositorio

- Producción se selecciona por NODE_ENV=production, salvo modo local/test explícito.
  Los cuatro comandos `start` y `prestart` fuerzan APP_ENV=production. El build no
  requiere ni incrusta credenciales. Las pruebas de las aplicaciones compiladas
  usan APP_ENV=test explícito.
- EXPOSURE_SCOPE debe ser `closed-synthetic-pilot`. Cada API exige
  PILOT_ALLOWED_USER_IDS y cada web PILOT_ALLOWED_EMAILS. Ninguna lista otorga
  roles ni sustituye los guards actuales. Un UUID ajeno se rechaza antes de
  consultar información privada. No hay excepciones por documentos de fixtures.
- El registro ciudadano del prototipo sigue disponible en local/test. En este
  piloto productivo las altas son por invitación/aprovisionamiento autorizado;
  `/register` y su Server Action no crean usuarios. El propietario deberá cerrar
  también el signup alojado de Credenly. RAES continúa sin registro público.
- Los valores de configuración erróneos nunca se incluyen en errores. Se rechazan
  secretos ajenos a un proceso y variables NEXT_PUBLIC que indiquen secretos.
  Las webs usan publishable/anon para Auth, nunca service_role.
- Recuperación compartida para RAES Admin, Credenly ciudadano y Credenly Admin,
  con cookies independientes de las normales y entre los dos accesos Credenly.
- Límites de admisión compartidos, logging, liveness/readiness y utilidades de
  secretos, privacidad, backup, restore y comprobación de acciones externas.
- Las pruebas canónicas siguen siendo locales: SQL/WASM y transportes Auth
  simulados, aplicaciones Next compiladas y navegador real. No son pruebas de
  correo entregado ni un nuevo login contra Supabase alojado.

## Autenticación y recuperación

| Producto | Solicitud | Confirmación del enlace | Nueva contraseña |
| --- | --- | --- | --- |
| RAES Admin | /forgot-password | /auth/recovery | /reset-password |
| Credenly ciudadano | /forgot-password | /auth/recovery | /reset-password |
| Credenly Admin | /admin/forgot-password | /admin/auth/recovery | /admin/reset-password |

La solicitud responde con el mismo texto para cuentas desconocidas y fallos de
entrega. Solo los buzones de la cohorte pueden solicitar correo en producción.
El enlace usa PKCE y su `sb_flow_id`; requiere el navegador que lo solicitó. Un GET
no consume el código: la persona confirma mediante POST/Server Action. Se exige
el evento público PASSWORD_RECOVERY del SDK y se verifica el usuario con Auth.
No se convierten callbacks normales en sesiones de recuperación.

Después se crea una prueba HMAC HttpOnly vinculada al UUID y al token de esa sesión,
con vigencia máxima de diez minutos. No se acepta una sesión normal como sustituto.
Antes de cambiar la contraseña se consulta el endpoint de introspección de la API
propia: roles activos para administración y guard ciudadano para Credenly. Los
estados SUSPENDIDO/CERRADO y la exclusión ciudadano/admin siguen vigentes. La
contraseña debe coincidir con su confirmación y tener 12–256 caracteres.

Al actualizar se solicita signOut global y se eliminan las cookies de ese acceso.
Si falla el cierre global después del cambio, la UI informa que la contraseña sí
cambió y que el cierre no pudo confirmarse. No presenta un éxito completo falso.
La expiración de JWT ya emitidos depende de Auth alojado: deberá probarse la
revocación real y fijarse su TTL antes de habilitar tráfico. No se afirma que borrar
cookies invalide por sí solo cualquier access token.

Los redirects usan SITE_URL validada, nunca Host ni un `next` arbitrario. Todos
estos documentos/URLs son privados y no-store; el proxy de hosting también debe
redactar código/token, querystrings, Authorization y Cookie.

Referencias de los contratos utilizados: [recuperación PKCE](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
y [sesiones SSR](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

## Protección contra abuso

La API mantiene su freno local acotado, y en producción consume además
`consume_production_limit` en su propia DB. Su upsert utiliza el reloj y el bloqueo
de PostgreSQL: no hay una cuota independiente por réplica. Las tablas tienen RLS,
sin grants browser ni escrituras directas service_role; la RPC solo admite
service_role. Los sujetos son HMAC, no correos, IPs ni tokens en claro. Se elimina
un número acotado de ventanas expiradas al consumir; no se guarda historial
permanente de estos contadores.

| Clase | Límite conservado o añadido |
| --- | --- |
| API general | 600/minuto globales + freno local existente |
| OCR POST | 6/minuto globales; worker/tamaño/dimensiones/timeout existentes intactos |
| Altas y decisiones administrativas POST | 20/minuto globales |
| Detecciones/propuestas | 120/minuto globales |
| Consulta pública de comparticiones | 120/minuto globales |
| Health/readiness | 120/minuto; liveness no depende de la DB |
| Login / intercambio de recuperación | 10/15 minutos por sujeto |
| Solicitar recuperación | 3/15 minutos por sujeto |
| Registro local/prototipo | Producción lo bloquea; política de admisión preparada: 5/15 minutos |

Las webs envían únicamente sujetos HMAC a POST /api/v1/internal/admission de su
API, autenticadas con ADMISSION_SECRET de servidor. No reciben acceso a la DB.
Los límites los decide el servidor, no el cuerpo del cliente. Un fallo de DB/RPC
falla cerrado con 503; el exceso produce 429 y Retry-After. No se cae silenciosamente
a memoria si falta la migración.

TRUSTED_CLIENT_IP_HEADER requiere un ingress que sobrescriba ese header y bloquee
el acceso directo al origen. No se confía por defecto en x-forwarded-for ni se
aceptan cadenas de varias IPs. Los checks directos de salud usan cuota global.
El código no protege por sí solo llamadas directas a GoTrue: límites de Auth,
confirmación, SMTP y cierre del signup se verifican también en Supabase.

## Identidad y KYC

El requisito del proyecto es procesamiento documental local y vinculación por
identificador con RAES. OCR extrae texto, interpreta etiquetas y estima confianza;
RAES resuelve una identidad y devuelve su estado académico aprobado. Eso no prueba
autenticidad documental, titularidad física, presencia, biometría o identidad legal.

Para el **piloto sintético cerrado aprobado** no se añade KYC como requisito de
software. La custodia de la cohorte y el aislamiento son requisitos operacionales.
Para una oferta pública con personas/datos reales sería obligatorio decidir un
mecanismo de garantía de identidad y revisar su integración antes de habilitarla;
no es una propiedad que pueda activarse con un flag del piloto. No se integra un
proveedor ni se presume una garantía legal a partir del OCR.

## B. Acciones externas finales

1. Elegir hosting y cuatro orígenes HTTPS separados; cerrar el piloto en red y
   configurar ingress confiable, TLS, redacción y no-store/cookies sin caché.
2. Aprobar la cohorte sintética, proporcionar sus UUIDs/correos y configurar cada
   servicio solo con sus variables. Sergio permanece sin perfil y fuera de altas
   automáticas. No eliminar ni recrear usuarios existentes.
3. Revisar ambos proyectos Auth: signup cerrado en RAES **y Credenly para este
   piloto**, mínimo 12, confirmación, SITE_URL, allowlist exacta de callbacks,
   límites, OTP/JWT/sesiones, SMTP y plantillas. No asumir que están configurados.
4. Proporcionar/autorizar el correo y comprobar entrega real, PKCE inválido/vencido,
   recuperación, logout y comportamiento de tokens anteriores en cuentas de prueba
   autorizadas. No se enviaron correos reales en esta rama.
5. Decidir y verificar la protección de contraseñas filtradas sin contratar planes.
   No marcarla resuelta solamente por usar contraseñas largas o pasar el audit npm.
6. Proporcionar referencias/custodia de secretos y autorizar las rotaciones que
   correspondan. ADMISSION_SECRET se genera con CSPRNG (al menos 32 bytes) y se
   comparte solo entre la web y API del mismo producto; no es clave de negocio.
7. Aprobar/aplicar las dos migraciones versionadas nuevas, en sus proyectos correctos.
   No repetir las anteriores, repair/reset, baseline ni fixtures institucionales.
8. Aprobar retención, RPO/RTO y almacenamiento cifrado; ensayar restore de una copia
   autorizada de plataforma/datos en un destino nuevo aislado y medir resultados.
9. Configurar monitores/alertas, horario de conectores y responsables de atender
   propuestas, fallos, cuotas y revocaciones; no automatizar aprobación académica.
10. Autorizar después el despliegue escalonado y su validación de red/hosting.

La plantilla [owner-inputs.example.json](owner-inputs.example.json) comienza bloqueada.
Una copia externa contiene referencias de evidencia, nunca secretos. Ejecutar
`pnpm production:check /ruta/owner-inputs.json` sobre el commit que se desplegaría.
El verificador exige versión exacta, evidencia reciente y cada acción; su resultado
OWNER_ATTESTED significa declaración del propietario, no inspección remota propia.
Un PASS de CI no cambia esas casillas ni autoriza despliegue.

Ver [operación](operations.md), [variables](../environment.md),
[evidencia de calidad](../reports/production-readiness-2026-11-19.md).
