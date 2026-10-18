# Desarrollo

## Requisitos

- Node.js 20 o superior.
- pnpm.
- Acceso autorizado a los proyectos Supabase.

## Secretos

Los secretos nunca se confirman en Git.

Cada servicio recibe únicamente las credenciales que necesita:

- `connector-poli`: Institución A + credenciales cliente RAES.
- `raes-api`: RAES.
- Credenly: su propia base + acceso autorizado a la API RAES.

Credenly nunca recibe una service role key de RAES.

## Validación de auditoría de clientes

Con la migración `20261018163434_api_client_audit.sql` aplicada en RAES y sus
credenciales locales existentes, iniciar el backend compilado en un puerto libre:

```bash
pnpm --filter @raes/api build
pnpm --filter @raes/api exec next start -p 3101
```

En otra terminal, desde `services/raes-api`:

```bash
node --env-file=.env.local --env-file=../credenly-api/.env.local --import=tsx scripts/verify-api-client-audit.ts
```

El script consulta una persona existente, verifica respuestas y cuatro eventos de
auditoría sin imprimir identidad ni secretos. Solo agrega auditoría; no modifica
personas, credenciales, versiones ni eventos académicos. Se restringe a un
servidor local; el puerto puede cambiarse con `RAES_AUDIT_TEST_API_BASE_URL`.

`supabase/raes/tests/api_client_audit.sql` verifica los cuatro tipos de actor,
rechazo de actores desconocidos y aislamiento de `anon`/`authenticated`. Toda
fila de prueba se revierte dentro de la transacción. Ejecutarlo en RAES mediante
una conexión SQL autorizada; no requiere nuevas claves.

`pnpm lint` existe en la raíz, pero actualmente ningún paquete declara un script
`lint`: su salida exitosa no constituye una revisión estática de estilo.

## Operación de conectores

Para este piloto se incluye una herramienta genérica server-side que reutiliza el
modelo de aprovisionamiento existente. La incorporación normal de universidades
sigue correspondiendo a la API administrativa; el script no crea perfiles ni
estado de envío en las instituciones.

Desde `services/raes-api`, con la configuración server-side local ya existente:

```bash
node --env-file=.env.local --import=tsx scripts/provision-connector.ts ../connector-udea/.env.local UDEA
```

Lee la institución fuente, crea/reutiliza su integración, asigna scopes y registra
actor `SISTEMA`. Solo entrega un secreto nuevo al archivo local de ese conector,
con permisos 0600; no lo imprime ni rota secretos existentes de forma implícita.
Para Poli se usa el mismo script y el prefijo `POLI`.

Las dos cuentas CLI se seleccionan explícitamente: `--profile supabase` para
RAES/Credenly y `--profile /ruta/al/perfil/instituciones.toml` para las fuentes.
Un perfil personalizado es un TOML con endpoints públicos y un nombre de almacén
local; no contiene tokens. El login se guarda en el llavero del sistema.

## Verificación multiinstitución con datos existentes

Con RAES local en 3101, desde `services/raes-api`:

```bash
node --env-file=.env.local --import=tsx scripts/verify-multi-institution.ts
```

Lee las dos fuentes, verifica identidad/linaje y aislamiento en RAES, consulta la
API como consumidor y ejecuta la lectura real del servicio Credenly con su vínculo
existente. Solo imprime métricas. No inicia sesión como un ciudadano ni modifica
su identidad; el recorrido de la ruta ciudadana se prueba con transporte simulado.

`supabase/raes/tests/credential_lifecycle_existing_data.sql` prueba las RPC sobre
una credencial vigente existente. Cada escenario se revierte por subtransacción y
la transacción externa se revierte también. No ejecutar cambios manuales de estado
para sustituir esta prueba: los estados terminales normales son irreversibles.

## Verificación pública real

Con RAES en 3101 y Credenly compilado en 3102, desde `services/credenly-api`:

```bash
RAES_API_BASE_URL=http://localhost:3101 node --env-file=.env.local --import=tsx scripts/verify-public-sharing.ts
```

Usa el ciudadano de prueba ya vinculado, crea una compartición por servicio interno,
consulta la ruta HTTP pública y la revoca. Verifica 200 -> revocación -> 410,
procedencia RAES, tokens hasheados y auditoría pseudonimizada. No inicia sesión
como el ciudadano ni cambia datos académicos. Incluso si falla una aserción, el
script revoca el enlace en `finally`. No imprime el token ni identidades.

Las pruebas SQL de `supabase/credenly/tests` comprueban ejecución exclusiva del
servidor para vinculación, permisos de columnas del perfil y RLS de propiedad.
