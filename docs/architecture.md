# Arquitectura

## Vista general

```text
Base Institución A -> Conector A ┐
                                 ├-> RAES API -> RAES DB
Base Institución B -> Conector B ┘                │
                                                   v
                                               Credenly
```

Las bases institucionales representan sistemas académicos naturales y no conocen RAES.

RAES administra instituciones e integraciones, pero la información académica de sedes, programas, personas y credenciales llega desde las instituciones.

Credenly contiene autenticación, perfil, verificación OCR, vinculación con RAES y comparticiones.

**Credenly no tiene tabla de credenciales.**

El perfil académico, el detalle de una credencial y la verificación pública consultan RAES para obtener el estado actual.
