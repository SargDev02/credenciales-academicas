# Connector Politécnico

Primer conector institucional de RAES.

Lee la base académica de Institución A y transforma sus datos a los contratos públicos de RAES. **No modifica la base institucional**, no agrega tablas RAES y no persiste estado de sincronización dentro del Politécnico.

## Flujo

```text
Supabase Institución A (solo lectura)
        ↓
transformaciones locales + Zod
        ↓
RAES API
        ├── institución
        ├── sedes
        ├── programas
        ├── programa-sede
        ├── personas
        └── credenciales
```

El conector nunca usa UUID internos de RAES.

## Configuración

Copia el ejemplo:

```bash
cp services/connector-poli/.env.example services/connector-poli/.env.local
```

Completa localmente:

- `POLI_SUPABASE_URL`;
- `POLI_SUPABASE_SERVICE_ROLE_KEY`;
- `RAES_API_BASE_URL`;
- `RAES_POLI_CLIENT_ID`;
- `RAES_POLI_CLIENT_SECRET`.

`.env.local` está ignorado por Git. No se deben copiar secretos al repositorio ni al chat.

La service role de Institución A se usa únicamente para lectura porque las tablas académicas tienen RLS sin políticas de cliente.

## Ejecución

Con RAES API disponible:

```bash
pnpm --filter @raes/connector-poli sync
```

Solo datos base:

```bash
pnpm --filter @raes/connector-poli sync:base
```

Solo credenciales:

```bash
pnpm --filter @raes/connector-poli sync:credentials
```

Una credencial concreta:

```bash
pnpm --filter @raes/connector-poli sync -- --only=credentials --credential-code=CODIGO
```

## Orden de sincronización

1. institución;
2. sedes;
3. programas;
4. relaciones programa-sede;
5. estudiantes/personas;
6. credenciales.

El orden garantiza que las referencias académicas existan antes de registrar credenciales.

## Idempotencia

El conector no crea tablas de control en la institución.

RAES conserva el estado de las operaciones mediante `operaciones_api`. El conector genera claves deterministas a partir del identificador institucional de cada credencial.

Un reintento del mismo registro reutiliza la operación previa. Si el contenido de una credencial administrada por el conector cambia, RAES detecta el conflicto del registro original y el conector emite una corrección versionada.

## Estados terminales

Los estados institucionales se normalizan así:

```text
REVOCADO / REVOCADA -> REVOCADA
ANULADO  / ANULADA  -> ANULADA
```

Una credencial terminal nueva se registra primero con su versión inicial y después se aplica su transición terminal, preservando el historial.

## Credenciales previamente existentes

Si una credencial ya existe en RAES pero fue creada por un proceso distinto al conector, el conector **no la adopta ni la modifica silenciosamente**. La reporta en `existingCredentialsNotAdopted`.

Esto evita que una primera ejecución del conector cambie historial previo sin evidencia suficiente.
