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
