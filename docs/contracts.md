# Contratos de integración

Los contratos de `packages/contracts` son el idioma común entre conectores institucionales y RAES.

## Regla de diseño

El esquema de una universidad nunca se convierte en el esquema de RAES.

Cada conector traduce sus tablas y nombres internos a contratos estándar.

Ejemplo:

```text
Institución
numero_documento
      ↓
conector
      ↓
numeroDocumento
      ↓
RAES API
```

## Contratos iniciales

- institución;
- sede;
- programa;
- persona;
- credencial nueva;
- corrección de credencial;
- revocación;
- anulación.

## Correcciones

Una corrección transporta una fotografía completa del contenido actualizado de la credencial, en lugar de un parche parcial. Esto reduce ambigüedad y permite que RAES cree una nueva versión reproducible.

El identificador estable de la credencial es `codigoOrigen`.

## Idempotencia

La idempotencia será responsabilidad del protocolo HTTP de RAES API y no del contenido académico. Se definirá en la siguiente etapa mediante un encabezado o identificador de operación autenticado.

## Identidad

Una persona se identifica de forma maestra en RAES por:

```text
tipoDocumento + numeroDocumento
```

`identificadorOrigen` conserva la referencia propia de la institución.
