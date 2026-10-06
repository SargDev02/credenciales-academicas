# Credenly API

Backend independiente de Credenly.

## Responsabilidades

- validar sesiones de Supabase Auth de Credenly;
- administrar el perfil ciudadano;
- orquestar verificación de identidad;
- conservar únicamente la vinculación verificada con una persona de RAES;
- consultar credenciales académicas siempre en vivo mediante RAES API;
- administrar comparticiones y verificaciones públicas.

## Regla de almacenamiento

Credenly **no almacena credenciales académicas ni copias persistentes de su estado**.

Puede conservar referencias externas como `raes_persona_id` y `raes_credencial_id`, además de datos propios de autenticación, verificación, compartición y auditoría.

## Desarrollo local

Copia:

```bash
cp services/credenly-api/.env.example services/credenly-api/.env.local
```

Completa localmente:

```text
CREDENLY_SUPABASE_URL
CREDENLY_SUPABASE_SERVICE_ROLE_KEY

RAES_API_BASE_URL=http://localhost:3001
RAES_CREDENLY_CLIENT_ID
RAES_CREDENLY_CLIENT_SECRET
```

Nunca confirmes secretos reales en Git.

Ejecuta:

```bash
pnpm --filter @credenly/api dev
```

Puerto local:

```text
http://localhost:3002
```

## Endpoints implementados

```text
GET /api/v1/health
GET /api/v1/health/ready

GET /api/v1/auth/me
Authorization: Bearer <supabase_access_token>

GET /api/v1/profile
PUT /api/v1/profile
Authorization: Bearer <supabase_access_token>

GET  /api/v1/raes/link
POST /api/v1/raes/link
Authorization: Bearer <supabase_access_token>

GET /api/v1/credentials
Authorization: Bearer <supabase_access_token>
```

`POST /api/v1/raes/link` no acepta número de documento directamente. Recibe el ID de una verificación de identidad que ya debe estar en estado `APROBADA`. Credenly toma la identidad extraída de esa verificación, resuelve la persona mediante RAES y confirma la vinculación de forma transaccional.

`GET /api/v1/credentials` requiere una vinculación RAES en estado `VERIFICADA` y consulta las credenciales en vivo mediante RAES API. La respuesta declara `persistedByCredenly: false` para reforzar que Credenly no almacena copias académicas.

## Estado actual

La base de Credenly ya contiene:

- `perfiles`;
- `verificaciones_identidad`;
- `vinculaciones_raes`;
- `comparticiones`;
- `accesos_compartidos`.

La autenticación de servicio Credenly -> RAES ya está implementada. El siguiente paso es conectar el flujo de OCR/verificación de identidad con `POST /api/v1/raes/link` y validar la consulta ciudadana de credenciales de extremo a extremo.


## OCR local sin servicios de pago

La primera implementación de OCR utiliza `tesseract.js` en el backend de Credenly. No requiere Google Vision, AWS Textract, Azure Document Intelligence ni otro proveedor de pago.

Endpoint:

```text
POST /api/v1/identity-verifications
Authorization: Bearer <supabase_access_token>
Content-Type: multipart/form-data
campo: documento
```

Formatos iniciales:

- JPEG;
- PNG;
- WEBP;
- máximo 8 MB.

El documento se procesa en memoria. Credenly no guarda la imagen en almacenamiento persistente durante este flujo; `imagen_path` permanece en `null` y se registra `imagen_eliminada_at` al finalizar el procesamiento.

La verificación conserva:

- tipo y número de documento extraídos;
- nombres y apellidos extraídos;
- texto OCR para trazabilidad;
- confianza OCR normalizada entre 0 y 1;
- proveedor `TESSERACT_LOCAL`;
- estado;
- motivo de revisión o fallo;
- timestamps de procesamiento.

Decisión inicial:

- `APROBADA`: identidad completa y confianza OCR >= 0.90;
- `REVISION`: identidad principal encontrada pero confianza menor o nombres incompletos;
- `RECHAZADA`: no se logra identificar tipo y número de documento.

Una verificación `APROBADA` habilita el flujo ya existente de vinculación con RAES.

> Esta etapa es verificación documental basada en OCR. No debe presentarse como validación biométrica o prueba criptográfica de autenticidad del documento.


## Comparticiones y verificación pública

Credenly puede crear enlaces temporales para compartir una credencial sin almacenar una copia académica.

Endpoints autenticados:

```text
GET  /api/v1/shares
POST /api/v1/shares
DELETE /api/v1/shares/:shareId
Authorization: Bearer <supabase_access_token>
```

Creación:

```json
{
  "raesCredencialId": "<uuid>",
  "expiresInHours": 168,
  "camposVisibles": [
    "programa",
    "sede",
    "fechaGrado"
  ]
}
```

El token público:

- se genera con entropía criptográfica;
- se devuelve en texto plano una sola vez al crear la compartición;
- Credenly conserva únicamente su SHA-256 y un prefijo identificador;
- puede expirar o ser revocado.

Endpoint público:

```text
GET /api/v1/public/shares/:token
```

La verificación pública consulta la credencial actual en RAES en cada acceso. Credenly no persiste el título, estado, programa ni otra copia de la credencial.

Siempre se muestran los campos mínimos necesarios para verificar la credencial:

- código RAES;
- tipo y categoría;
- estado actual;
- versión actual;
- institución;
- título;
- fecha de emisión;
- fecha del estado terminal si aplica.

Los campos opcionales controlados por `camposVisibles` son:

- `programa`;
- `sede`;
- `descripcion`;
- `fechaGrado`;
- `numeroActa`;
- `numeroFolio`;
- `numeroLibro`;
- `motivoEstado`.

Cada acceso válido, expirado, revocado o con credencial no disponible se registra en `accesos_compartidos`. La IP, cuando está disponible detrás del proxy, se pseudonimiza mediante HMAC y no se almacena en texto plano.
