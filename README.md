# Credenciales Académicas — RAES + Credenly

Proyecto de integración y verificación de credenciales académicas.

## Arquitectura

```text
Institución A ─┐
               ├──> RAES API ───> RAES DB
Institución B ─┘                    │
                                    ▼
                                 Credenly
```

- **Instituciones**: originan la información académica.
- **RAES**: recibe, valida, conserva, versiona y expone la información académica mediante API.
- **Credenly**: registra ciudadanos, verifica su identidad, los vincula con RAES y presenta credenciales consultadas desde RAES.
- **Credenly nunca almacena credenciales académicas ni una copia persistente de su estado.**

## Principios

1. Las cuatro bases de datos son físicamente independientes.
2. No existen foreign keys entre proyectos Supabase.
3. Las instituciones no contienen tablas específicas de RAES.
4. RAES no modifica manualmente la verdad académica originada por una institución.
5. RAES conserva versiones y eventos para mantener trazabilidad.
6. Credenly consulta RAES al mostrar o verificar credenciales.
7. RAES Web y Credenly se desplegarán como aplicaciones independientes.

Consulta [docs/progress.md](docs/progress.md) para el estado del proyecto.
