# Integraciones

Los conectores Politécnico y Universidad de Antioquia leen fuentes físicas
independientes y reutilizan `packages/connector-core` para contratos, transporte,
reconciliación y ciclo de vida. Las instituciones no contienen tablas específicas
ni conocimiento interno de RAES.

```text
Fuente institucional -> lectura paginada -> contratos Zod -> RAES API -> RAES DB
```

El estado vigente se consulta por API con aislamiento institucional; los conectores
no reciben acceso a RAES DB. Las instituciones conservan RLS y no reciben escrituras
ni estado de sincronización del conector. Credenly usa exclusivamente la API RAES
para los datos académicos y su propio proyecto para Auth y datos ciudadanos.

Las claves de operación tienen namespaces separados y RAES mantiene su idempotencia
transaccional. Una corrección no sobrescribe versiones, ni una revocación/anulación
elimina credenciales. Los conflictos terminales y registros de otras operaciones
se reportan al operador; no se adoptan automáticamente.

Ejecución y configuración en los README de `services/connector-poli` y
`services/connector-udea`. Evidencia real y pendientes en `docs/progress.md`.
