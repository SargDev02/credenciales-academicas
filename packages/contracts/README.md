# @raes/contracts

Paquete compartido de contratos de integración entre conectores institucionales y RAES.

Incluye schemas Zod y tipos TypeScript para:

- institución;
- sede;
- programa;
- persona;
- credencial nueva;
- corrección;
- revocación;
- anulación.

## Comandos

```bash
pnpm --filter @raes/contracts typecheck
pnpm --filter @raes/contracts test
```

Los contratos no conocen la estructura SQL particular de ninguna universidad. Cada conector es responsable de realizar la transformación desde su sistema de origen.
