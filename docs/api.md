# RAES API

RAES API será el punto de entrada de las integraciones institucionales y el punto de consulta académica autorizado para Credenly.

## Base URL de desarrollo

```text
http://localhost:3001/api/v1
```

## Health

### `GET /health`

Comprueba que el proceso HTTP está funcionando. No depende de Supabase.

### `GET /health/ready`

Comprueba que la configuración del servicio es válida y que RAES API puede consultar su proyecto Supabase.

## Seguridad de conexión

La `RAES_SUPABASE_SERVICE_ROLE_KEY`:

- solo existe en el entorno del servidor RAES API;
- nunca se envía al navegador;
- nunca se comparte con conectores institucionales;
- nunca se comparte con Credenly;
- nunca se guarda en Git.

Las integraciones institucionales usarán credenciales propias de RAES API, que se implementarán en la siguiente subetapa.
