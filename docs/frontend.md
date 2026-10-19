# Frontend del prototipo

## Arquitectura y alcance

`apps/raes-web` y `apps/credenly-web`: Next.js 16.3.8, React 19, App Router y
TypeScript. Se construyen por separado, sin despliegues. `packages/ui` ofrece
presentación sin lógica RAES/ciudadana; `packages/web-core` ofrece HTTP tipado,
errores sanitizados, timeout/cancelación, configuración y destinos de retorno.

## Figma

Fuente: [Proyecto Integrador](https://www.figma.com/design/c9AfXPKUI4ClSj2Bqwkb1d/Proyecto-Integrador---Credenciales-Acad%C3%A9micas).
Se inspeccionaron por MCP contexto de código y screenshots de los siete nodos:

| Componente | Nodo | Implementación |
| --- | --- | --- |
| Button / Primary | 1:26 | Button primary, 44 px, radio 12 px |
| Button / Secondary | 1:28 | Button secondary, borde neutral |
| Input / Default | 1:30 | Input/FormField, 44 px, radio 10 px |
| Badge / Vigente | 1:34 | Badge success con texto visible |
| Badge / Revocada | 1:36 | Badge danger con texto visible |
| Badge / Anulada | 1:38 | Badge warning con texto visible |
| Card / Credencial | 1:40 | CredentialCard, padding 18/20, radio 16, gap 10 |

Tokens originales en `packages/ui/src/styles.css`: marca #254EA4, texto #111825,
muted #636F84, borde #DAE0EA, superficie #FFFFFF y estados #139151/#D12525/#C27D0F.
Se mantienen Inter y escalas 12/18, 14/22, 18/26. Los badges originales miden 100 px
de alto: la variante `design` conserva esa geometría; `compact` (30 px) extiende el
sistema para tablas. Verde/ámbar de texto se oscurecen sobre sus fondos suaves para
contraste AA; los tokens originales siguen disponibles. No se usan frameworks UI,
assets pagos ni URLs temporales Figma. El archivo Figma no fue modificado.

## Responsive y accesibilidad

Base fluida para 360/768/1024/1440 px, labels explícitos, controles nativos, foco
visible, enlaces de salto, mensajes semánticos y movimiento reducido. Los estados
siempre tienen texto, no solo color. Galería `/design-system` en ambas apps: datos
rotulados de demostración y ninguna consulta académica.

## Variables y comandos

Copiar el `.env.example` de cada app a su `.env.local` ignorado. URL Supabase y
clave publishable/anon corresponden exclusivamente al proyecto de esa aplicación:
`RAES_WEB_SUPABASE_URL`, `RAES_WEB_SUPABASE_PUBLISHABLE_KEY`, `RAES_API_BASE_URL`;
y equivalentes `CREDENLY_*`. No se admiten claves service_role. Son variables del
servidor web; no se exportan tokens al JavaScript del navegador.

```bash
pnpm --filter @raes/web dev       # 3000; API RAES 3001
pnpm --filter @credenly/web dev   # 3003; API Credenly 3002
pnpm typecheck
pnpm test
pnpm lint
pnpm -r --if-present build
```

## Contratos y limitaciones verificadas de RAES

Disponibles: GET/POST `/api/v1/admin/institutions`, GET/POST
`/api/v1/admin/api-clients`, POST `/api/v1/admin/institutions/{id}/integrations`.
El detalle puede derivarse del listado sin inventar una ruta API.

No hay endpoint de perfil/rol del administrador: `/auth/whoami` corresponde a
integraciones institucionales, no a usuarios administrativos. El backend consulta
`perfiles_admin` internamente. Tampoco existen GET de auditoría/integraciones ni
scopes asignados en el listado de clientes. No hay acceso directo a esas tablas
desde frontend, ni roles inferidos desde `user_metadata`.

La primera RAES Web será de lectura para los tres roles válidos. Antes de habilitar
altas por rol se propone aprobar `GET /api/v1/admin/me`, usando `authenticateAdmin`
con SUPERADMIN/ADMIN/AUDITOR y devolviendo únicamente id, nombre y rol/estado. No
requiere esquema, RPC ni service role en la web. **No se modifica backend sin aprobación.**
Auditoría e integraciones no consultables se explican en pantalla; no se inventan
estadísticas, scopes ni listados. Credenly integrado espera el reporte de ese bloque.
