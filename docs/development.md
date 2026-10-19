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

## Verificación multiinstitución C/D

Los fixtures aprobados y aplicados una vez se describen exactamente en
`supabase/fixtures/multi-institution/README.md`. No volver a aplicar sus SQL: abortan
ante colisiones deliberadamente. La sincronización se hace por los conectores,
nunca insertando personas o credenciales en RAES. Con RAES local compilado en 3101:

```bash
RAES_API_BASE_URL=http://localhost:3101 pnpm --filter @raes/connector-poli sync
RAES_API_BASE_URL=http://localhost:3101 pnpm --filter @raes/connector-udea sync
```

Desde `services/raes-api`, después de completar ambos conectores:

```bash
node --env-file=.env.local --import=tsx scripts/verify-multi-institution.ts --record-baseline=/tmp/raes-cd-baseline.json
```

Repetir ambos comandos de sincronización y comparar:

```bash
node --env-file=.env.local --import=tsx scripts/verify-multi-institution.ts --compare-baseline=/tmp/raes-cd-baseline.json
```

El verificador exige la identidad sintética compartida, una persona maestra, dos
fuentes con IDs institucionales diferentes y ambas credenciales con procedencia
correcta. Valida aislamiento 404, consulta RAES HTTP y el cliente real Credenly para
la persona compartida; también conserva la lectura del ciudadano existente.
Es de solo lectura. Guarda exclusivamente cantidades y huellas SHA-256 locales,
sin snapshots académicos, documentos ni secretos. Compara identidades, fuentes,
credenciales, operaciones, versiones y eventos; el replay debe ser `IDENTICAL`.
Los timestamps de actualización de personas/fuentes no forman parte de esa
comparación: se comprueba identidad/linaje estable y el contenido académico íntegro.
La auditoría de consultas sí puede crecer legítimamente.

La lectura del cliente Credenly no representa por sí sola un login ciudadano.
Para comprobar además la ruta HTTP autenticada con esta identidad hay un verificador
separado que requiere autorización explícita para una cuenta temporal:

```bash
# Desde services/credenly-api; solo tras autorizar los datos ciudadanos temporales.
RAES_API_BASE_URL=http://localhost:3101 node --env-file=.env.local --import=tsx scripts/verify-shared-person.ts --temporary-citizen
```

Prepara únicamente una cuenta sintética sin envío de correo, perfil, verificación
`MOCK_DESARROLLO` y vinculación. Usa la resolución/vinculación de los servicios,
realiza login real y exige HTTP 200 con ambas credenciales, `source: RAES` y
`persistedByCredenly: false`. No prueba autenticidad ni OCR real. Revoca la sesión,
elimina en orden vinculación, verificación, perfil y usuario Auth. Si falla un
paso se detiene sin forzar cascadas. Comprueba Auth 404, ausencia de residuos y
rechazo HTTP 401 posterior. No almacena datos académicos en Credenly.
Los fixtures de las instituciones y su historial RAES se conservan.

La ejecución autorizada del 2026-10-18 pasó contra ambos servicios compilados.
Además se comprobó por SQL ausencia de usuario, sesión y datos ciudadanos; las
huellas de las cinco tablas Credenly y las siete tablas de cada institución fueron
idénticas antes/después. Los UUID HTTP se corresponden con los dos códigos fuente
documentados; la aplicación no introduce excepciones para este fixture.

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

## Frontend

Ver `docs/frontend.md` para configuración por aplicación, referencia Figma y gaps
de las APIs. La base visual puede ejecutarse sin conexión a Supabase:

```bash
pnpm --filter @raes/web dev
pnpm --filter @credenly/web dev
```

Puertos 3000/3003; la galería `/design-system` usa datos explícitamente de demo.
Comprobaciones comunes: `pnpm typecheck`, `pnpm test`, `pnpm -r --if-present build`.
