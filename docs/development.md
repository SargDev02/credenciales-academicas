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
