# Integraciones

## Primer objetivo

Conectar Institución A con RAES antes de desarrollar interfaces.

```text
Politécnico DB -> connector-poli -> contratos Zod -> RAES API -> RAES DB
```

El conector lee la institución, transforma al contrato estándar, valida, se autentica, envía operaciones idempotentes y detecta cambios incrementales.

Contratos previstos: institución, sede, programa, persona, credencial nueva, corrección, revocación y anulación.

Universidad de Antioquia se integrará después usando los mismos endpoints y contratos.
