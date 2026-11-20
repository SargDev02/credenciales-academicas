# Variables de entorno

Estado 2026-10-19. Archivos `.env.local` ignorados; `.env.example` solo plantillas.
No copiar el entorno completo de un operador al proceso web. Ninguna variable
server-only utiliza NEXT_PUBLIC. Las claves publishable/anon admitidas por Auth
son públicas por diseño, pero esta implementación las usa en el servidor web.

| Aplicación | Variables | Lugar | Requisito dev / futuro prod | Sensibilidad |
| --- | --- | --- | --- | --- |
| RAES API | RAES_SUPABASE_URL | Servidor | Ambas obligatorias | URL pública |
| RAES API | RAES_SUPABASE_SERVICE_ROLE_KEY | Servidor | Ambas obligatorias | Secreto privilegiado RAES |
| Credenly API | CREDENLY_SUPABASE_URL | Servidor | Ambas obligatorias | URL pública |
| Credenly API | CREDENLY_SUPABASE_SERVICE_ROLE_KEY | Servidor | Ambas obligatorias | Secreto privilegiado Credenly |
| Credenly API | RAES_API_BASE_URL | Servidor | Ambas obligatorias | URL de servicio, HTTP solo local; HTTPS externo |
| Credenly API | RAES_CREDENLY_CLIENT_ID | Servidor | Ambas obligatorias | Identificador; sin permiso por sí solo |
| Credenly API | RAES_CREDENLY_CLIENT_SECRET | Servidor | Ambas obligatorias | Secreto consumidor RAES |
| connector-poli | POLI_SUPABASE_URL | Operador/conector | Ambas obligatorias | URL pública institución A |
| connector-poli | POLI_SUPABASE_SERVICE_ROLE_KEY | Operador/conector | Ambas obligatorias | Secreto privilegiado A; el conector solo lee |
| connector-poli | RAES_API_BASE_URL, RAES_POLI_CLIENT_ID | Operador/conector | Ambas obligatorias | URL / identificador de integración |
| connector-poli | RAES_POLI_CLIENT_SECRET | Operador/conector | Ambas obligatorias | Secreto integración A |
| connector-udea | UDEA_SUPABASE_URL | Operador/conector | Ambas obligatorias | URL pública institución B |
| connector-udea | UDEA_SUPABASE_SERVICE_ROLE_KEY | Operador/conector | Ambas obligatorias | Secreto privilegiado B; el conector solo lee |
| connector-udea | RAES_API_BASE_URL, RAES_UDEA_CLIENT_ID | Operador/conector | Ambas obligatorias | URL / identificador de integración |
| connector-udea | RAES_UDEA_CLIENT_SECRET | Operador/conector | Ambas obligatorias | Secreto integración B |
| RAES Web | RAES_WEB_SUPABASE_URL, RAES_WEB_SUPABASE_PUBLISHABLE_KEY | Servidor web | Ambas obligatorias | URL pública / publishable o legacy anon; service_role rechazado |
| RAES Web | RAES_API_BASE_URL | Servidor web | Ambas obligatorias | URL de API; HTTPS fuera de local |
| RAES Web | RAES_WEB_ALLOWED_DEV_ORIGINS | Config dev | Opcional dev, no necesaria prod | Hosts LAN explícitos, sin secretos |
| Credenly Web | CREDENLY_WEB_SUPABASE_URL, CREDENLY_WEB_SUPABASE_PUBLISHABLE_KEY | Servidor web | Ambas obligatorias | URL pública / publishable o legacy anon; service_role rechazado |
| Credenly Web | CREDENLY_API_BASE_URL | Servidor web | Ambas obligatorias | URL de API; HTTPS fuera de local |
| Credenly Web | CREDENLY_WEB_SITE_URL | Servidor web | Opcional dev (localhost:3003); obligatorio antes de prod | Origen canónico para confirmación, registrar allowlist Auth |
| Credenly Web | CREDENLY_WEB_ALLOWED_DEV_ORIGINS | Config dev | Opcional dev, no necesaria prod | Hosts LAN explícitos, sin secretos |

No hay variables browser obligatorias. El browser llama a su origen web y recibe
cookies HttpOnly separadas; las webs usan JWT de usuario para sus APIs. No recibe
secretos de integración ni claves privilegiadas. La clave de RAES nunca entra al
proceso Credenly ni a su web.

Herramientas de QA admiten URLs TEST_BASE_URL y un override opcional
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH. Son configuración local de operador, no
variables del producto. CLI Supabase usa perfiles en Keychain; sus PAT no se
imprimen, versionan ni pasan a procesos web. Los tests canónicos de CI no usan
cuentas, variables reales ni proyectos remotos. `NEXT_TELEMETRY_DISABLED=1` en CI
solo desactiva telemetría del framework.

## Configuración productiva del piloto cerrado 2026-11-19

Esta sección prevalece sobre los ejemplos históricos de localhost. Cada proceso
recibe únicamente su entorno; la raíz no es un archivo común de claves. Consultar
las seis plantillas `.env.example`. `start`/`prestart` fuerzan APP_ENV=production y
permiten PORT; `dev` y los fixtures locales tienen otra finalidad.

| Proceso | Variables obligatorias de producción |
| --- | --- |
| RAES API | RAES_SUPABASE_URL, RAES_SUPABASE_SERVICE_ROLE_KEY, RAES_ADMISSION_SECRET, PILOT_ALLOWED_USER_IDS, TRUSTED_CLIENT_IP_HEADER |
| RAES Web | RAES_WEB_SUPABASE_URL, RAES_WEB_SUPABASE_PUBLISHABLE_KEY, RAES_API_BASE_URL, RAES_WEB_SITE_URL, RAES_ADMISSION_SECRET, PILOT_ALLOWED_EMAILS, TRUSTED_CLIENT_IP_HEADER |
| Credenly API | CREDENLY_SUPABASE_URL, CREDENLY_SUPABASE_SERVICE_ROLE_KEY, RAES_API_BASE_URL, RAES_CREDENLY_CLIENT_ID, RAES_CREDENLY_CLIENT_SECRET, CREDENLY_ADMISSION_SECRET, PILOT_ALLOWED_USER_IDS, TRUSTED_CLIENT_IP_HEADER |
| Credenly Web | CREDENLY_WEB_SUPABASE_URL, CREDENLY_WEB_SUPABASE_PUBLISHABLE_KEY, CREDENLY_API_BASE_URL, CREDENLY_WEB_SITE_URL, CREDENLY_ADMISSION_SECRET, PILOT_ALLOWED_EMAILS, TRUSTED_CLIENT_IP_HEADER |
| Poli | POLI_SUPABASE_URL, POLI_SUPABASE_SERVICE_ROLE_KEY, RAES_API_BASE_URL, RAES_POLI_CLIENT_ID, RAES_POLI_CLIENT_SECRET |
| UdeA | UDEA_SUPABASE_URL, UDEA_SUPABASE_SERVICE_ROLE_KEY, RAES_API_BASE_URL, RAES_UDEA_CLIENT_ID, RAES_UDEA_CLIENT_SECRET |

Todos exigen EXPOSURE_SCOPE=closed-synthetic-pilot. APP_ENV admite local/test para
herramientas y pruebas aisladas, no como configuración de hosting productivo. Las
URLs productivas son orígenes HTTPS sin userinfo/query/hash/path ni direcciones
locales. SITE_URL no tiene fallback localhost en producción. Las claves privilegiadas
se validan como secret/service_role; las webs solo admiten publishable/anon. IDs y
secretos de integración conservan sus prefijos/protocolo RAES.

ADMISSION_SECRET no es una service role: autentica la web con su API para admisión
y firma la prueba de recuperación. Nunca lo recibe el browser. Cada producto tiene
uno diferente y el par web/API debe coincidir. Cambiarlo requiere coordinación.

PILOT_ALLOWED_USER_IDS es una lista de UUIDs Auth de ese producto, separada por
comas; PILOT_ALLOWED_EMAILS es la cohorte de buzones sintéticos para recuperación.
No se derivan roles de correos, listas o metadata. Las altas del piloto son por
invitación/aprovisionamiento autorizado; no se crea ni restaura ningún perfil por
introducir un UUID en la lista. El propietario debe excluir Sergio y mantener su
decisión de no tener perfil ciudadano.

TRUSTED_CLIENT_IP_HEADER es el nombre exacto, en minúsculas, de un header que el
proxy real sobrescribe. El origen no debe ser accesible por otra ruta. No copiar
un nombre sugerido sin comprobar la plataforma. Un valor ausente/malformado en
solicitudes protegidas falla cerrado; health usa su cuota global para permitir
sondeos directos sin simular un usuario.

Las variables de URLs y publishable keys no son secretos privilegiados, pero no
justifican mezclar credenciales entre proyectos. No usar NEXT_PUBLIC para secretos.
Nunca pasar una clave RAES de DB al proceso Credenly. La configuración alojada de
Auth, SMTP, redirects, expiraciones y signup se verifica por separado: este
validador solo conoce la configuración local que recibe.
